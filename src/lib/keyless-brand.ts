/**
 * Keyless brand fallback — favicon fetch, dependency-free PNG decode, dominant
 * color extraction, and theme-color meta-tag scraping.
 *
 * This is the SINGLE canonical implementation of the "no BRANDFETCH_API_KEY, no
 * paid API" brand-detection path. It used to be copy-pasted (with drift) across
 * three files: src/app/api/brand/route.ts, src/app/api/domain/submit/route.ts,
 * and src/app/api/design-engine/mockup/route.ts — the last of which had fallen
 * behind and was still using the deprecated Clearbit logo API instead of this
 * favicon+PNG-decode approach. All three now import from here.
 *
 * Requires the Node.js runtime (zlib + Buffer), not Edge.
 */
import zlib from 'node:zlib'

interface KeylessBrandResult {
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  companyName: string
  domain: string
  source: 'favicon' | 'theme-color' | 'fallback'
  colorSource: 'logo' | 'theme-color' | 'default'
}

// Neutral slate — used only when we truly can't derive a brand color.
// Deliberately NOT a saturated purple, so a fallback reads as "neutral", not
// "wrong brand".
const NEUTRAL_COLOR = '#4b5563'

/** icon.horse service: a real brand mark for ~every domain, keyless and
 * reliable from serverless. Provides 64px+ quality logos superior to Google's
 * 16px favicon. Both the logo AND the source we derive the brand
 * color from — far better than the deprecated Clearbit endpoint. */
function faviconUrl(domain: string): string {
  return `https://icon.horse/icon/${encodeURIComponent(domain)}`
}

/** Lighten a hex color by mixing with white. Used to derive a secondary color
 * from a primary when no second color is available. */
function lightenColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const factor = 0.6
    const nr = Math.round(r + (255 - r) * factor)
    const ng = Math.round(g + (255 - g) * factor)
    const nb = Math.round(b + (255 - b) * factor)
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
  } catch {
    return '#8fa3b8'
  }
}

/** Derive a company name from a domain. Example: "linear.app" -> "Linear" */
function deriveCompanyName(domain: string): string {
  const host = domain.replace(/^www\./, '')
  const name = host.split('.')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/* -------- dependency-free PNG decode -> dominant brand color -------- */

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Decode an 8-bit PNG (color types 0/2/3/4/6) -> flat RGBA pixels. Throws on
 * anything it can't handle so the caller falls back cleanly. */
function decodePng(buf: Buffer): Array<[number, number, number, number]> {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {throw new Error('not png')}
  let o = 8, w = 0, h = 0, bd = 0, ct = 0
  const idat: Buffer[] = []
  let plte: Buffer | null = null
  let trns: Buffer | null = null
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o)
    const type = buf.toString('ascii', o + 4, o + 8)
    const data = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9] }
    else if (type === 'PLTE') {plte = data}
    else if (type === 'tRNS') {trns = data}
    else if (type === 'IDAT') {idat.push(data)}
    else if (type === 'IEND') {break}
    o += 12 + len
  }
  if (bd !== 8 || w === 0 || h === 0) {throw new Error('unsupported png')}
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1
  const stride = w * ch
  const out = Buffer.alloc(h * stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const ft = raw[p++]
    for (let x = 0; x < stride; x++) {
      const rb = raw[p++]
      const a = x >= ch ? out[y * stride + x - ch] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= ch && y > 0 ? out[(y - 1) * stride + x - ch] : 0
      let v: number
      switch (ft) {
        case 1: v = rb + a; break
        case 2: v = rb + b; break
        case 3: v = rb + ((a + b) >> 1); break
        case 4: v = rb + paeth(a, b, c); break
        default: v = rb
      }
      out[y * stride + x] = v & 255
    }
  }
  const px: Array<[number, number, number, number]> = []
  for (let i = 0; i < w * h; i++) {
    let r: number, g: number, b: number, al = 255
    if (ct === 6) { r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; al = out[i * 4 + 3] }
    else if (ct === 2) { r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2] }
    else if (ct === 3 && plte) { const idx = out[i]; r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2]; if (trns && idx < trns.length) {al = trns[idx]} }
    else { r = g = b = out[i] }
    px.push([r, g, b, al])
  }
  return px
}

/** Dominant brand color: bucket opaque, non-white, non-black pixels and pick
 * the group with the best frequency x saturation score. Null if effectively
 * mono/transparent (caller falls back). */
function dominantColor(px: Array<[number, number, number, number]>): string | null {
  const buckets = new Map<string, { r: number; g: number; b: number; n: number; sat: number }>()
  for (const [r, g, b, a] of px) {
    if (a < 128) {continue}
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn
    if (mx > 240 && sat < 20) {continue} // near-white
    if (mx < 25) {continue}              // near-black
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, sat: 0 }
    e.r += r; e.g += g; e.b += b; e.n++; e.sat += sat
    buckets.set(key, e)
  }
  let best: { r: number; g: number; b: number; n: number; sat: number } | null = null
  let bestScore = -1
  for (const e of buckets.values()) {
    const score = e.n * (1 + (e.sat / e.n) / 255 * 3)
    if (score > bestScore) { bestScore = score; best = e }
  }
  if (!best) {return null}
  const R = Math.round(best.r / best.n), G = Math.round(best.g / best.n), B = Math.round(best.b / best.n)
  return '#' + [R, G, B].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** Fetch the favicon and derive its dominant color. Always returns a logoUrl
 * (icon.horse endpoint renders a logo for most domains). */
async function fetchFaviconBrand(domain: string): Promise<{ logoUrl: string; color: string | null }> {
  const logoUrl = faviconUrl(domain)
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const r = await fetch(logoUrl, { signal: controller.signal })
    clearTimeout(t)
    if (!r.ok) {return { logoUrl, color: null }}
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 64) {return { logoUrl, color: null }} // Failed decode or too small
    return { logoUrl, color: dominantColor(decodePng(buf)) }
  } catch {
    return { logoUrl, color: null }
  }
}

/** Secondary color source: the site's own theme-color / msapplication-TileColor
 * meta tag (used only when the favicon yields no color). */
async function fetchThemeColor(domain: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`https://${domain}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 SwaggerAI-BrandBot/1.0 (+https://swagger.ai)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) {return null}
    const html = await res.text()

    const patterns = [
      /<meta[^>]+name=["']theme-color["'][^>]+content=["']([#\w]+)["']/i,
      /<meta[^>]+content=["']([#\w]+)["'][^>]+name=["']theme-color["']/i,
      /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([#\w]+)["']/i,
      /<meta[^>]+content=["']([#\w]+)["'][^>]+name=["']msapplication-TileColor["']/i,
    ]
    for (const re of patterns) {
      const m = html.match(re)
      if (m) {
        const color = m[1].trim()
        if (/^#[0-9a-f]{3,8}$/i.test(color)) {return color}
      }
    }
    return null
  } catch {
    return null
  }
}

/** The canonical keyless brand-detection path (no BRANDFETCH_API_KEY needed):
 * a REAL logo from icon.horse service + a brand color derived from that
 * logo (dependency-free PNG decode), with theme-color meta as a secondary
 * color source, and a neutral slate only when nothing is derivable. */
export async function fetchKeylessBrand(domain: string): Promise<KeylessBrandResult> {
  const [brand, themeColor] = await Promise.all([
    fetchFaviconBrand(domain),
    fetchThemeColor(domain),
  ])

  const primaryColor = brand.color ?? themeColor ?? NEUTRAL_COLOR
  const secondaryColor = lightenColor(primaryColor)
  const companyName = deriveCompanyName(domain)
  const colorSource: KeylessBrandResult['colorSource'] = brand.color ? 'logo' : themeColor ? 'theme-color' : 'default'
  const source: KeylessBrandResult['source'] = brand.color ? 'favicon' : themeColor ? 'theme-color' : 'fallback'

  return {
    domain,
    companyName,
    logoUrl: brand.logoUrl,
    primaryColor,
    secondaryColor,
    source,
    colorSource,
  }
}
