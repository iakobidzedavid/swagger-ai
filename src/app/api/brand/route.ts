import { NextRequest, NextResponse } from 'next/server'

interface BrandData {
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  raw: Record<string, unknown>
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

    // Try theme-color meta tag
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

function deriveCompanyName(domain: string): string {
  const host = domain.replace(/^www\./, '')
  const name = host.split('.')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function lightenColor(hex: string): string {
  // Produce a slightly muted variant for secondary color
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const factor = 0.6
  const nr = Math.round(r + (255 - r) * factor)
  const ng = Math.round(g + (255 - g) * factor)
  const nb = Math.round(b + (255 - b) * factor)
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain') ?? ''
  if (!domain) {
    return NextResponse.json({ error: 'domain param required' }, { status: 400 })
  }

  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  const [themeColor, logoExists] = await Promise.all([
    fetchThemeColor(normalized),
    checkLogoExists(normalized),
  ])

  const primaryColor = themeColor ?? '#7c3aed'
  const secondaryColor = themeColor ? lightenColor(themeColor) : '#8fa3b8'
  const logoUrl = logoExists ? `https://logo.clearbit.com/${normalized}` : null
  const companyName = deriveCompanyName(normalized)

  const brand: BrandData = {
    domain: normalized,
    companyName,
    logoUrl,
    primaryColor,
    secondaryColor,
    raw: {
      themeColorFound: !!themeColor,
      logoFound: logoExists,
      source: logoExists ? 'clearbit' : 'fallback',
    },
  }

  return NextResponse.json(brand)
}
