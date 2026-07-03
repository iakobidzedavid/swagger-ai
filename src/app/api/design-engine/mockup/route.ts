import { NextRequest, NextResponse } from 'next/server'
import { fetchBrandData } from '@/lib/brandfetch'
import { normalizeDomain } from '@/lib/brand'

// Brand extraction requires the Node.js runtime (zlib + Buffer for the
// keyless PNG-decode fallback in src/lib/keyless-brand.ts), not Edge.
export const runtime = 'nodejs'

interface BrandAsset {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  companyName: string
  domain: string
  source: 'brandfetch' | 'favicon' | 'theme-color' | 'fallback'
  colors?: string[] // Full color palette from Brandfetch
  fonts?: string[]  // Font families from Brandfetch
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
  colorPalette?: string[]  // Direct access to full color palette for design-engine
  brandFonts?: string[]    // Direct access to brand fonts for design-engine
  products?: ProductData[]
}

// Main endpoint
export async function GET(req: NextRequest) {
  const domainParam = req.nextUrl.searchParams.get('domain') ?? ''
  if (!domainParam) {
    return NextResponse.json({ error: 'domain param required' }, { status: 400 })
  }
  const domain = normalizeDomain(domainParam)

  // Single canonical brand-extraction entrypoint (src/lib/brandfetch.ts):
  // Brandfetch API first, keyless fallback (favicon + theme-color) second —
  // never Clearbit (deprecated/throttled, see BRANDFETCH_INTEGRATION.md).
  // Shared with /api/brand and /api/domain/submit so all three stay in lockstep.
  const brand = await fetchBrandData(domain)
  const brandAssets: BrandAsset = {
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    companyName: brand.companyName,
    domain: brand.domain,
    source: brand.source,
    colors: brand.colors,    // Full color palette from Brandfetch
    fonts: brand.fonts,      // Font families from Brandfetch
    raw: brand.raw,
  }

  // Fetch products from Printify API with brand colors and mockup generation
  let products: ProductData[] = []
  try {
    const printifyUrl = new URL('/api/printify/products', req.nextUrl.origin)
    printifyUrl.searchParams.set('domain', brandAssets.domain)
    printifyUrl.searchParams.set('primaryColor', brandAssets.primaryColor)
    printifyUrl.searchParams.set('secondaryColor', brandAssets.secondaryColor)
    printifyUrl.searchParams.set('companyName', brandAssets.companyName)
    if (brandAssets.logoUrl) {
      printifyUrl.searchParams.set('logoUrl', brandAssets.logoUrl)
    }

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
    colorPalette: brandAssets.colors,
    brandFonts: brandAssets.fonts,
    products,
  }

  return NextResponse.json(mockupResponse)
}
