import { NextRequest, NextResponse } from 'next/server'

interface BrandAsset {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  companyName: string
  domain: string
  source: 'brandfetch' | 'clearbit' | 'fallback'
  raw?: Record<string, unknown>
}

interface ProductData {
  id: string
  title: string
  description: string
  category: string
  image: string
  price: number
  sku: string
  primaryColor?: string
  secondaryColor?: string
}

interface MockupResponse {
  domain: string
  companyName: string
  brandAssets: BrandAsset
  mockupUrl: string
  shareableUrl: string
  products?: ProductData[]
}

// Brandfetch API client
async function fetchFromBrandfetch(domain: string): Promise<BrandAsset | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')

    const response = await fetch(`https://api.brandfetch.io/v2/brands/${normalizedDomain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) {
      console.warn(`Brandfetch request failed for ${normalizedDomain}: ${response.status}`)
      return null
    }

    const data = await response.json() as {
      name?: string
      logos?: Array<{ src?: string }>
      colors?: Array<{ hex?: string }>
    }

    const logoUrl = data.logos?.[0]?.src ?? null
    const colors = data.colors?.map(c => c.hex).filter(Boolean) as string[] | undefined
    const primaryColor = colors?.[0] ?? '#7c3aed'
    const secondaryColor = colors?.[1] ?? '#8fa3b8'
    const companyName = data.name ?? domain.split('.')[0]

    return {
      logoUrl,
      primaryColor,
      secondaryColor,
      companyName,
      domain: normalizedDomain,
      source: 'brandfetch',
      raw: data,
    }
  } catch (error) {
    console.warn('Brandfetch fetch error:', error)
    return null
  }
}

// Clearbit logo check
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

// Fetch theme color from website meta tags
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

// Fallback to clearbit + HTML scraping if Brandfetch unavailable
async function fetchFromClearbit(domain: string): Promise<BrandAsset | null> {
  try {
    const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')

    const [themeColor, logoExists] = await Promise.all([
      fetchThemeColor(normalizedDomain),
      checkLogoExists(normalizedDomain),
    ])

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

    function deriveCompanyName(domain: string): string {
      const host = domain.replace(/^www\./, '')
      const name = host.split('.')[0]
      return name.charAt(0).toUpperCase() + name.slice(1)
    }

    const primaryColor = themeColor ?? '#7c3aed'
    const secondaryColor = themeColor ? lightenColor(primaryColor) : '#8fa3b8'
    const logoUrl = logoExists ? `https://logo.clearbit.com/${normalizedDomain}` : null
    const companyName = deriveCompanyName(normalizedDomain)

    return {
      logoUrl,
      primaryColor,
      secondaryColor,
      companyName,
      domain: normalizedDomain,
      source: 'clearbit',
      raw: {
        themeColorFound: !!themeColor,
        logoFound: logoExists,
      },
    }
  } catch (error) {
    console.warn('Clearbit fallback error:', error)
    return null
  }
}

function deriveCompanyName(domain: string): string {
  const host = domain.replace(/^www\./, '')
  const name = host.split('.')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// Main endpoint
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain') ?? ''
  if (!domain) {
    return NextResponse.json({ error: 'domain param required' }, { status: 400 })
  }

  // Try Brandfetch first, then fall back to Clearbit
  let brandAssets = await fetchFromBrandfetch(domain)
  if (!brandAssets) {
    brandAssets = await fetchFromClearbit(domain)
  }

  // If still no assets, return minimal fallback
  if (!brandAssets) {
    const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    brandAssets = {
      logoUrl: null,
      primaryColor: '#7c3aed',
      secondaryColor: '#8fa3b8',
      companyName: deriveCompanyName(normalizedDomain),
      domain: normalizedDomain,
      source: 'fallback',
    }
  }

  // Fetch products from Printify API with brand colors
  let products: ProductData[] = []
  try {
    const printifyUrl = new URL('/api/printify/products', req.nextUrl.origin)
    printifyUrl.searchParams.set('domain', brandAssets.domain)
    printifyUrl.searchParams.set('primaryColor', brandAssets.primaryColor)
    printifyUrl.searchParams.set('secondaryColor', brandAssets.secondaryColor)

    const productsRes = await fetch(printifyUrl.toString())
    if (productsRes.ok) {
      const productsData = await productsRes.json() as { products: ProductData[] }
      products = productsData.products
    }
  } catch (err) {
    console.warn('Failed to fetch Printify products:', err)
    // Continue without products — they're optional
  }

  const mockupResponse: MockupResponse = {
    domain: brandAssets.domain,
    companyName: brandAssets.companyName,
    brandAssets,
    mockupUrl: `/design-engine?domain=${encodeURIComponent(brandAssets.domain)}`,
    shareableUrl: `${req.nextUrl.origin}/design-engine?domain=${encodeURIComponent(brandAssets.domain)}`,
    products,
  }

  return NextResponse.json(mockupResponse)
}
