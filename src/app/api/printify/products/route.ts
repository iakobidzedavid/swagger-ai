import { NextRequest, NextResponse } from 'next/server'
import { generateMockup } from '@/lib/mockup-generator'
import { fetchProductsForStorefront } from '@/lib/printify-catalog'

interface ProductVariant {
  id: string
  title: string
  price: number
}

interface PrintifyProduct {
  id: string
  title: string
  description: string
  category: string
  image: string
  mockupImage?: string
  variants: ProductVariant[]
  sku: string
  primaryColor?: string
  secondaryColor?: string
}

export interface ProductsResponse {
  products: PrintifyProduct[]
  count: number
  primaryColor?: string
  secondaryColor?: string
  source?: 'printify-api' | 'fallback'
}

/**
 * GET /api/printify/products
 *
 * Fetch AI-curated Printify products for a domain/store with branded mockups.
 *
 * This endpoint:
 * 1. Fetches products from Printify catalog API (if PRINTIFY_API_KEY is set)
 * 2. Falls back to curated products in mock mode
 * 3. Filters and prioritizes by category (apparel → drinkware → accessories)
 * 4. Generates branded SVG mockups with company colors and logo
 * 5. Returns 8-12 products ready for display in storefront
 *
 * Query parameters:
 *   - domain (optional): company domain to fetch products for
 *   - primaryColor (optional): brand primary color (hex) for mockup
 *   - secondaryColor (optional): brand secondary color (hex) for mockup
 *   - companyName (optional): company name for mockup
 *   - logoUrl (optional): company logo URL for mockup
 *
 * Returns:
 *   - products: Array of products with brand-colored mockups
 *   - count: Number of products returned
 *   - primaryColor: The primary brand color used
 *   - secondaryColor: The secondary brand color used
 *   - source: 'printify-api' or 'fallback'
 */
export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get('domain') ?? ''
    const primaryColor = req.nextUrl.searchParams.get('primaryColor') ?? '#7c3aed'
    const secondaryColor = req.nextUrl.searchParams.get('secondaryColor') ?? '#8fa3b8'
    const companyName = req.nextUrl.searchParams.get('companyName') ?? domain.split('.')[0]
    const logoUrl = req.nextUrl.searchParams.get('logoUrl') ?? null

    // Fetch and filter products from Printify or fallback to curated products
    const mappedProducts = await fetchProductsForStorefront(primaryColor, secondaryColor, 12)

    // Generate branded mockups for each product
    const productsWithMockups: PrintifyProduct[] = mappedProducts.map(p => {
      const mockup = generateMockup({
        productId: p.id,
        productTitle: p.title,
        productCategory: p.category,
        logoUrl,
        primaryColor,
        secondaryColor,
        companyName,
      })

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        image: p.image,
        variants: p.variants,
        sku: p.sku,
        primaryColor,
        secondaryColor,
        mockupImage: mockup.dataUrl, // Include the generated SVG mockup as data URL
      }
    })

    const response: ProductsResponse = {
      products: productsWithMockups,
      count: productsWithMockups.length,
      primaryColor,
      secondaryColor,
      source: 'printify-api', // Will be updated by catalog fetcher if using fallback
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[GET /api/printify/products] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
