import { NextRequest, NextResponse } from 'next/server'

/**
 * Brandfetch integration API route (DE-18 revenue engine).
 *
 * This is the canonical, reusable brand-lookup endpoint for the acquisition
 * funnel: the homepage domain-input widget (`HomepageBrandPreview`) calls it
 * for an instant, read-only preview before a visitor commits to the full
 * `/onboard` flow. It does NOT write to Supabase — the persisted record is
 * still created by `/api/domain/submit` when the user continues on `/onboard`.
 *
 * Brand source, in priority order:
 *   1. Real Brandfetch API (https://api.brandfetch.io/v2/brands/{domain}) —
 *      used only when BRANDFETCH_API_KEY is set in the environment.
 *   2. Keyless fallback — theme-color meta tag scrape + Clearbit logo check.
 *      Slower (~6-10s worst case) and less accurate for recently rebranded
 *      companies, but requires no credential.
 */

interface BrandData {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  source: 'brandfetch' | 'clearbit' | 'fallback'
  raw: Record<string, unknown>
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
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

async function checkLogoExists(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`https://logo.clearbit.com/${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  }
}

/** Keyless fallback: theme-color meta scrape + Clearbit logo existence check.
 * Same behavior as the route had before this integration — kept identical so
 * nothing regresses when BRANDFETCH_API_KEY is absent (today's default). */
async function fetchKeyless(domain: string): Promise<BrandData> {
  const [themeColor, logoExists] = await Promise.all([
    fetchThemeColor(domain),
    checkLogoExists(domain),
  ])

  const primaryColor = themeColor ?? '#7c3aed'
  const secondaryColor = themeColor ? lightenColor(themeColor) : '#8fa3b8'
  const logoUrl = logoExists ? `https://logo.clearbit.com/${domain}` : null
  const companyName = deriveCompanyName(domain)

  return {
    domain,
    companyName,
    logoUrl,
    primaryColor,
    secondaryColor,
    source: logoExists || themeColor ? 'clearbit' : 'fallback',
    raw: {
      themeColorFound: !!themeColor,
      logoFound: logoExists,
    },
  }
}

export async function GET(req: NextRequest) {
  const domainParam = req.nextUrl.searchParams.get('domain') ?? ''
  if (!domainParam) {
    return NextResponse.json({ error: 'domain param required' }, { status: 400 })
  }

  const domain = normalizeDomain(domainParam)
  if (!domain) {
    return NextResponse.json({ error: 'domain param required' }, { status: 400 })
  }

  const brand = (await fetchFromBrandfetch(domain)) ?? (await fetchKeyless(domain))

  return NextResponse.json(brand)
}
