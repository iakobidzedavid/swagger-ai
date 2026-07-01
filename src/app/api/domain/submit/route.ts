import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'mac.com',
])

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

interface BrandAssets {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: string
}

/**
 * Fetch brand data from Brandfetch API (if key is available).
 * Returns null if key is not available or request fails.
 */
async function fetchBrandfetchBrandAssets(domain: string): Promise<BrandAssets | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) return null

  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) return null

    const data = await res.json()

    let logoUrl: string | null = null
    if (data.logo?.url) {
      logoUrl = data.logo.url
    }

    let primaryColor = '#7c3aed'
    let secondaryColor = '#8fa3b8'

    // Extract colors from Brandfetch
    if (data.colors && Array.isArray(data.colors) && data.colors.length > 0) {
      const colorObjs = data.colors.filter((c: any) => c.hex)
      if (colorObjs.length > 0) {
        primaryColor = colorObjs[0].hex
        if (colorObjs.length > 1) {
          secondaryColor = colorObjs[1].hex
        } else {
          secondaryColor = lighten(primaryColor)
        }
      }
    }

    return {
      logoUrl,
      primaryColor,
      secondaryColor,
      source: 'brandfetch',
    }
  } catch (err) {
    console.error(
      `[Brandfetch] Failed to fetch brand for ${domain}:`,
      err instanceof Error ? err.message : String(err)
    )
    return null
  }
}

/**
 * Fetch theme color from website meta tags.
 */
async function fetchThemeColorFromHTML(domain: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`https://${domain}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 SwaggerAI-BrandBot/1.0',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })
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

/**
 * Check if Clearbit has a logo for this domain.
 */
async function checkClearbitLogo(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 2000)
    const r = await fetch(`https://logo.clearbit.com/${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
    })
    return r.ok
  } catch {
    return false
  }
}

/**
 * Lighten a hex color for use as secondary color.
 */
function lighten(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const f = 0.6
  return `#${Math.round(r + (255-r)*f).toString(16).padStart(2,'0')}${Math.round(g + (255-g)*f).toString(16).padStart(2,'0')}${Math.round(b + (255-b)*f).toString(16).padStart(2,'0')}`
}

/**
 * Derive company name from domain.
 */
function companyName(domain: string): string {
  const n = domain.replace(/^www\./, '').split('.')[0]
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/**
 * Fetch brand assets with fallback chain:
 * 1. Try Brandfetch API (if key available)
 * 2. Try Clearbit logo + HTML theme-color
 * 3. Fallback colors
 */
async function fetchBrandAssets(domain: string): Promise<BrandAssets> {
  // Try Brandfetch first
  const brandfetchResult = await fetchBrandfetchBrandAssets(domain)
  if (brandfetchResult) {
    return brandfetchResult
  }

  // Fallback: Clearbit + HTML theme-color
  const [themeColor, hasLogo] = await Promise.all([
    fetchThemeColorFromHTML(domain),
    checkClearbitLogo(domain),
  ])

  const primaryColor = themeColor ?? '#7c3aed'
  const secondaryColor = themeColor ? lighten(themeColor) : '#8fa3b8'
  const logoUrl = hasLogo ? `https://logo.clearbit.com/${domain}` : null

  return {
    logoUrl,
    primaryColor,
    secondaryColor,
    source: hasLogo ? 'clearbit' : 'fallback',
  }
}

export async function POST(req: NextRequest) {
  let body: { domain?: string; contact_name?: string; contact_email?: string }
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

  // Insert with fetching status first to immediately persist the submission
  const { data: inserted, error: insertErr } = await supabase
    .from('domain_submissions')
    .insert({
      domain: raw,
      status: 'fetching',
      raw_brand_data: { contact_name: contactName, contact_email: contactEmail },
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    console.error('Supabase insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
  }

  // Fetch brand assets with fallback chain
  const brandAssets = await fetchBrandAssets(raw)
  const name = companyName(raw)

  // Update record with fetched brand data
  const { data: updated, error: updateErr } = await supabase
    .from('domain_submissions')
    .update({
      status: 'detected',
      company_name: name,
      logo_url: brandAssets.logoUrl,
      primary_color: brandAssets.primaryColor,
      secondary_color: brandAssets.secondaryColor,
      raw_brand_data: {
        source: brandAssets.source,
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
      logo_url: brandAssets.logoUrl,
      primary_color: brandAssets.primaryColor,
      secondary_color: brandAssets.secondaryColor,
      status: 'detected',
      created_at: inserted.created_at,
    })
  }

  return NextResponse.json(updated)
}
