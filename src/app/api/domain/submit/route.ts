import { NextRequest, NextResponse } from 'next/server'
import zlib from 'node:zlib'
import { supabase } from '@/lib/supabase'
import { classifyAttribution, sanitizeAttribution } from '@/lib/attribution'

// zlib + Buffer require the Node.js runtime (not Edge).
export const runtime = 'nodejs'

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'mac.com',
])

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

// Neutral slate — used only when we truly can't derive a brand color. Deliberately
// NOT a saturated purple, so a fallback reads as "neutral", not "wrong brand".
const NEUTRAL = '#4b5563'

/** Google's favicon service returns a real brand mark for ~every domain, keyless
 * and reliable from serverless. This is the logo AND the source we derive the
 * brand color from. sz=256 asks for the largest square Google has. */
function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
}

/* -------------------------------------------------------------------------- */
/*  Brand color from the logo — minimal dependency-free PNG decoder            */
/* -------------------------------------------------------------------------- */

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Decode an 8-bit PNG (color types 0/2/3/4/6) to a flat RGBA pixel array.
 * Throws on anything it can't handle so the caller can fall back cleanly. */
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

/** Pick the dominant brand color: bucket opaque, non-white, non-black pixels and
 * choose the group with the best frequency×saturation score. Returns null when the
 * mark is effectively monochrome/transparent (caller falls back). */
function dominantColor(px: Array<[number, number, number, number]>): string | null {
  const buckets = new Map<string, { r: number; g: number; b: number; n: number; sat: number }>()
  for (const [r, g, b, a] of px) {
    if (a < 128) continue
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn
    if (mx > 240 && sat < 20) continue // near-white
    if (mx < 25) continue              // near-black
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

/** Fetch the logo and derive its dominant color. Always returns a logoUrl (the
 * favicon renders even when we can't decode it for color). */
async function fetchBrand(domain: string): Promise<{ logoUrl: string; color: string | null }> {
  const logoUrl = faviconUrl(domain)
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const r = await fetch(logoUrl, { signal: controller.signal })
    clearTimeout(t)
    if (!r.ok) return { logoUrl, color: null }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 64) return { logoUrl, color: null } // Google's tiny default globe
    return { logoUrl, color: dominantColor(decodePng(buf)) }
  } catch {
    return { logoUrl, color: null }
  }
}

/** Secondary color source: the site's own theme-color meta (used only when the
 * logo yields no color). */
async function fetchThemeColor(domain: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`https://${domain}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 SwaggerAI-BrandBot/1.0', Accept: 'text/html' },
      redirect: 'follow',
    })
    clearTimeout(t)
    if (!res.ok) return null
    const html = await res.text()
    const patterns = [
      /<meta[^>]+name=["']theme-color["'][^>]+content=["']([#\w]+)["']/i,
      /<meta[^>]+content=["']([#\w]+)["'][^>]+name=["']theme-color["']/i,
    ]
    for (const re of patterns) {
      const m = html.match(re)
      if (m) {
        const c = m[1].trim()
        if (/^#[0-9a-f]{3,8}$/i.test(c)) return c
      }
    }
  } catch {}
  return null
}

function lighten(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const f = 0.6
  return `#${Math.round(r + (255 - r) * f).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * f).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * f).toString(16).padStart(2, '0')}`
}

function companyName(domain: string): string {
  const n = domain.replace(/^www\./, '').split('.')[0]
  return n.charAt(0).toUpperCase() + n.slice(1)
}

export async function POST(req: NextRequest) {
  let body: {
    domain?: string
    contact_name?: string
    contact_email?: string
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    referrer_host?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = (body.domain ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const contactName = (body.contact_name ?? '').trim() || null
  const contactEmail = (body.contact_email ?? '').trim().toLowerCase() || null

  if (!raw) return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  if (!DOMAIN_RE.test(raw)) return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
  if (PERSONAL_DOMAINS.has(raw)) return NextResponse.json({ error: 'Please enter a company domain' }, { status: 400 })

  // Revenue-engine attribution (DE-18): trust nothing from the client beyond
  // length-clipped strings — classify server-side into the same taxonomy the
  // channels admin page reads (supabase/migrations/0007_channel_attribution.sql).
  const attribution = sanitizeAttribution({
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    referrer_host: body.referrer_host,
  })
  const attributionKey = classifyAttribution(attribution)

  // Insert with pending status first to immediately persist the submission
  const { data: inserted, error: insertErr } = await supabase
    .from('domain_submissions')
    .insert({
      domain: raw,
      status: 'fetching',
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      referrer_host: attribution.referrer_host,
      attribution_key: attributionKey,
      raw_brand_data: { contact_name: contactName, contact_email: contactEmail },
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    console.error('Supabase insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
  }

  // Derive brand: color from the logo first (accurate), theme-color as a fallback.
  const [brand, themeColor] = await Promise.all([
    fetchBrand(raw),
    fetchThemeColor(raw),
  ])

  const primaryColor = brand.color ?? themeColor ?? NEUTRAL
  const secondaryColor = lighten(primaryColor)
  const logoUrl = brand.logoUrl
  const colorSource = brand.color ? 'logo' : themeColor ? 'theme-color' : 'default'
  const name = companyName(raw)

  // Update record with fetched brand data
  const { data: updated, error: updateErr } = await supabase
    .from('domain_submissions')
    .update({
      status: 'detected',
      company_name: name,
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      raw_brand_data: {
        logoSource: 'favicon',
        colorSource,
        themeColorFound: !!themeColor,
        source: colorSource === 'default' ? 'fallback' : colorSource,
        contact_name: contactName,
        contact_email: contactEmail,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', inserted.id)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('Supabase update error:', updateErr)
    // Still return the inserted record with what we have
    return NextResponse.json({
      id: inserted.id,
      domain: raw,
      company_name: name,
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      status: 'detected',
      created_at: inserted.created_at,
    })
  }

  return NextResponse.json(updated)
}
