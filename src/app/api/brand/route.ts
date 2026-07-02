import { NextRequest, NextResponse } from 'next/server'
import zlib from 'node:zlib'
import { supabase } from '@/lib/supabase'
import { DOMAIN_RE, normalizeDomain, isCacheFresh } from '@/lib/brand'

// zlib + Buffer (favicon color extraction) require the Node.js runtime, not Edge.
export const runtime = 'nodejs'

/**
 * Brandfetch integration API route (DE-18 revenue engine).
 *
 * This is the canonical, reusable brand-lookup endpoint for the acquisition
 * funnel: the homepage domain-input widget (`HomepageBrandPreview`) calls it
 * for an instant, read-only preview before a visitor commits to the full
 * `/onboard` flow. It does NOT write the user-facing submission record —
 * that's still created by `/api/domain/submit` when the user continues on
 * `/onboard`. It DOES read/write a perf-only `brand_cache` table (see below)
 * so repeat lookups of the same domain skip redundant external fetches.
 *
 * Brand source, in priority order:
 *   1. `brand_cache` (Supabase) — a fresh (<24h) cached result for this exact
 *      domain, from ANY prior lookup by ANY visitor. Cuts external calls for
 *      popular/repeat domains. Never a hard dependency: any cache read/write
 *      failure falls through to fetching live, so Supabase being unreachable
 *      never breaks this endpoint.
 *   2. Real Brandfetch API (https://api.brandfetch.io/v2/brands/{domain}) —
 *      used only when BRANDFETCH_API_KEY is set in the environment.
 *   3. Keyless fallback — theme-color meta tag scrape + Clearbit logo check.
 *      Slower (~6-10s worst case) and less accurate for recently rebranded
 *      companies, but requires no credential.
 */

interface BrandCacheRow {
  domain: string
  company_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  source: string
  raw_brand_data: Record<string, unknown> | null
  hit_count: number
  fetched_at: string
}

interface BrandData {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: 'brandfetch' | 'favicon' | 'theme-color' | 'fallback'
  raw: Record<string, unknown>
}

function deriveCompanyName(domain: string): string {
  const host = domain.replace(/^www\./, '')
  const name = host.split('.')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function lightenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const factor = 0.6
  const nr = Math.round(r + (255 - r) * factor)
  const ng = Math.round(g + (255 - g) * factor)
  const nb = Math.round(b + (255 - b) * factor)
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

// Neutral slate — used only when we can derive NOTHING. Deliberately not a
// saturated purple, so a fallback reads as "neutral", not "wrong brand".
const NEUTRAL = '#4b5563'

/** Google's favicon service: a real brand mark for ~every domain, keyless and
 * reliable from serverless. It is both the logo and the source we derive the
 * brand color from — far better than the deprecated Clearbit endpoint. */
function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
}

/* -------- dependency-free PNG decode → dominant brand color -------- */

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Decode an 8-bit PNG (color types 0/2/3/4/6) → flat RGBA pixels. Throws on
 * anything it can't handle so the caller falls back cleanly. */
function decodePng(buf: Buffer): Array<[number, number, number, number]> {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png')
  let o = 8, w = 0, h = 0, bd = 0, ct = 0
  const idat: Buffer[] = []
  let plte: Buffer | null = null
  let trns: Buffer | null = null
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o)
    const type = buf.toString('ascii', o + 4, o + 8)
    const data = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9] }
    else if (type === 'PLTE') plte = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    o += 12 + len
  }
  if (bd !== 8 || w === 0 || h === 0) throw new Error('unsupported png')
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
    else if (ct === 3 && plte) { const idx = out[i]; r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2]; if (trns && idx < trns.length) al = trns[idx] }
    else { r = g = b = out[i] }
    px.push([r, g, b, al])
  }
  return px
}

/** Dominant brand color: bucket opaque, non-white, non-black pixels and pick the
 * group with the best frequency×saturation score. Null if effectively mono. */
function dominantColor(px: Array<[number, number, number, number]>): string | null {
  const buckets = new Map<string, { r: number; g: number; b: number; n: number; sat: number }>()
  for (const [r, g, b, a] of px) {
    if (a < 128) continue
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn
    if (mx > 240 && sat < 20) continue
    if (mx < 25) continue
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
  if (!best) return null
  const R = Math.round(best.r / best.n), G = Math.round(best.g / best.n), B = Math.round(best.b / best.n)
  return '#' + [R, G, B].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** Fetch the favicon and derive its dominant color. Always returns a logoUrl. */
async function fetchFaviconBrand(domain: string): Promise<{ logoUrl: string; color: string | null }> {
  const logoUrl = faviconUrl(domain)
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const r = await fetch(logoUrl, { signal: controller.signal })
    clearTimeout(t)
    if (!r.ok) return { logoUrl, color: null }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 64) return { logoUrl, color: null }
    return { logoUrl, color: dominantColor(decodePng(buf)) }
  } catch {
    return { logoUrl, color: null }
  }
}

/** Real Brandfetch API client. Returns null (never throws) when the key is
 * unset, the request fails, or the response doesn't parse — caller falls
 * back to the keyless path in every one of those cases. */
async function fetchFromBrandfetch(domain: string): Promise<BrandData | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) {
      console.warn(`Brandfetch request failed for ${domain}: ${response.status}`)
      return null
    }

    const data = await response.json() as {
      name?: string
      logos?: Array<{ src?: string }>
      colors?: Array<{ hex?: string }>
    }

    const logoUrl = data.logos?.[0]?.src ?? null
    // Only trust hex strings shaped like a real color — Brandfetch is a
    // third-party response body; a malformed/non-hex value here must not
    // reach lightenColor() (which assumes #rrggbb and would otherwise emit
    // "#NaNNaNNaN" as the secondary color).
    const isHex = (v: string | undefined): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v)
    const colors = data.colors?.map(c => c.hex).filter(isHex)
    const primaryColor = colors?.[0] ?? '#7c3aed'
    const secondaryColor = colors?.[1] ?? (colors?.[0] ? lightenColor(colors[0]) : '#8fa3b8')
    const companyName = data.name ?? deriveCompanyName(domain)

    return {
      domain,
      companyName,
      logoUrl,
      primaryColor,
      secondaryColor,
      source: 'brandfetch',
      raw: data,
    }
  } catch (error) {
    console.warn('Brandfetch fetch error:', error)
    return null
  }
}

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
    if (!res.ok) return null
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
        if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
      }
    }
    return null
  } catch {
    return null
  }
}

/** Keyless fallback (today's default, no BRANDFETCH_API_KEY): a REAL logo from
 * Google's favicon service + a brand color derived from that logo (dependency-
 * free PNG decode). theme-color meta is only a secondary color source; a neutral
 * slate is used when nothing is derivable — never a hardcoded purple. This mirrors
 * `/api/domain/submit` so the two endpoints stay consistent. */
async function fetchKeyless(domain: string): Promise<BrandData> {
  const [brand, themeColor] = await Promise.all([
    fetchFaviconBrand(domain),
    fetchThemeColor(domain),
  ])

  const primaryColor = brand.color ?? themeColor ?? NEUTRAL
  const secondaryColor = lightenColor(primaryColor)
  const companyName = deriveCompanyName(domain)
  const colorSource = brand.color ? 'logo' : themeColor ? 'theme-color' : 'default'

  return {
    domain,
    companyName,
    logoUrl: brand.logoUrl,
    primaryColor,
    secondaryColor,
    source: brand.color ? 'favicon' : themeColor ? 'theme-color' : 'fallback',
    raw: {
      logoSource: 'favicon',
      colorSource,
      themeColorFound: !!themeColor,
    },
  }
}

function cacheRowToBrandData(row: BrandCacheRow): BrandData {
  return {
    domain: row.domain,
    companyName: row.company_name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    // Additive-only annotation — neither existing caller (HomepageBrandPreview,
    // /onboard) reads `raw`, so merging `cached: true` in cannot break them.
    source: row.source as BrandData['source'],
    raw: { ...(row.raw_brand_data ?? {}), cached: true, hitCount: row.hit_count },
  }
}

/** Best-effort cache read. Returns null on any failure (missing table, RLS
 * denial, network blip) or on a stale/missing row — caller always falls
 * through to a live fetch in every one of those cases. */
async function readCache(domain: string): Promise<BrandCacheRow | null> {
  try {
    const { data, error } = await supabase
      .from('brand_cache')
      .select('*')
      .eq('domain', domain)
      .maybeSingle()
    if (error || !data) return null
    const row = data as BrandCacheRow
    if (!isCacheFresh(row.fetched_at, Date.now())) return null
    return row
  } catch (err) {
    console.warn('brand_cache read failed (continuing without cache):', err)
    return null
  }
}

/** Fire-and-forget hit-count bump on a cache hit — never awaited by the
 * request path so a cache hit stays fast even if this write is slow/fails.
 * Wrapped defensively: this must never throw into the request path even if
 * the Supabase client construction itself fails synchronously. */
function bumpHitCount(domain: string, currentHitCount: number) {
  try {
    Promise.resolve(
      supabase
        .from('brand_cache')
        .update({ hit_count: currentHitCount + 1 })
        .eq('domain', domain),
    )
      .then((result: { error: unknown }) => {
        if (result.error) console.warn('brand_cache hit_count bump failed:', result.error)
      })
      .catch((err: unknown) => console.warn('brand_cache hit_count bump threw:', err))
  } catch (err) {
    console.warn('brand_cache hit_count bump threw synchronously:', err)
  }
}

/** Best-effort cache write after a live fetch. Never throws — a cache write
 * failure must not turn a successful brand fetch into a 500. */
async function writeCache(brand: BrandData): Promise<void> {
  try {
    const { error } = await supabase
      .from('brand_cache')
      .upsert(
        {
          domain: brand.domain,
          company_name: brand.companyName,
          logo_url: brand.logoUrl,
          primary_color: brand.primaryColor,
          secondary_color: brand.secondaryColor,
          source: brand.source,
          brand_source: brand.source,
          color_count: brand.raw?.colorCount ?? 0,
          font_count: brand.raw?.fontCount ?? 0,
          raw_brand_data: brand.raw,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'domain' },
      )
    if (error) console.warn('brand_cache write failed (continuing, cache is perf-only):', error)
  } catch (err) {
    console.warn('brand_cache write threw (continuing, cache is perf-only):', err)
  }
}

export async function GET(req: NextRequest) {
  const domainParam = req.nextUrl.searchParams.get('domain') ?? ''
  if (!domainParam) {
    return NextResponse.json({ error: 'domain param required' }, { status: 400 })
  }

  const domain = normalizeDomain(domainParam)
  // 253 is the real max length of a DNS name — rejects anything that can't
  // possibly be a domain before it ever reaches the cache table.
  if (!domain || domain.length > 253 || !DOMAIN_RE.test(domain)) {
    return NextResponse.json({ error: 'Enter a valid domain (e.g., acme.com)' }, { status: 400 })
  }

  const cached = await readCache(domain)
  if (cached) {
    bumpHitCount(domain, cached.hit_count)
    return NextResponse.json(cacheRowToBrandData(cached))
  }

  const brand = (await fetchFromBrandfetch(domain)) ?? (await fetchKeyless(domain))
  await writeCache(brand)

  return NextResponse.json(brand)
}
