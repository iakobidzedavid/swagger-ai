/**
 * Printify Catalog Fetcher — Safe wrapper for fetching Printify products
 *
 * Attempts to fetch real products from Printify catalog when API key available.
 * Falls back to curated products when in mock mode or API is unavailable.
 */

import { getPrintifyClient, type PrintifyProduct } from './printify'
import { filterAndPrioritizeProducts, mapPrintifyProducts, type MappedProduct } from './printify-product-mapper'

/**
 * Curated fallback products (used in mock mode or as defaults)
 */
export const CURATED_FALLBACK_PRODUCTS = [
  {
    id: 'printify-001',
    title: 'Classic T-Shirt',
    description: 'Premium 100% cotton unisex t-shirt',
    category: 'apparel',
    images: [{ src: 'https://via.placeholder.com/300x300/000000/ffffff?text=T-Shirt' }],
    variants: [{ id: 'v1', title: 'Small', price: 18, sku: 'TSHIRT-UNISEX-001' }],
  },
  {
    id: 'printify-002',
    title: 'Hoodie',
    description: 'Comfortable cotton blend hoodie with drawstrings',
    category: 'apparel',
    images: [{ src: 'https://via.placeholder.com/300x300/333333/ffffff?text=Hoodie' }],
    variants: [{ id: 'v1', title: 'Small', price: 42, sku: 'HOODIE-UNISEX-001' }],
  },
  {
    id: 'printify-003',
    title: 'Coffee Mug',
    description: '11oz ceramic coffee mug with glossy finish',
    category: 'drinkware',
    images: [{ src: 'https://via.placeholder.com/300x300/ffffff/000000?text=Mug' }],
    variants: [{ id: 'v1', title: 'Standard', price: 12, sku: 'MUG-11OZ-001' }],
  },
  {
    id: 'printify-004',
    title: 'Water Bottle',
    description: 'Insulated 20oz stainless steel water bottle',
    category: 'drinkware',
    images: [{ src: 'https://via.placeholder.com/300x300/4a90e2/ffffff?text=Bottle' }],
    variants: [{ id: 'v1', title: 'Standard', price: 24, sku: 'BOTTLE-20OZ-001' }],
  },
  {
    id: 'printify-005',
    title: 'Baseball Cap',
    description: 'Structured 6-panel cotton baseball cap',
    category: 'apparel',
    images: [{ src: 'https://via.placeholder.com/300x300/555555/ffffff?text=Cap' }],
    variants: [{ id: 'v1', title: 'One Size', price: 20, sku: 'CAP-6PANEL-001' }],
  },
  {
    id: 'printify-006',
    title: 'Sweatpants',
    description: 'Cozy fleece-lined sweatpants with pockets',
    category: 'apparel',
    images: [{ src: 'https://via.placeholder.com/300x300/666666/ffffff?text=Sweatpants' }],
    variants: [{ id: 'v1', title: 'Small', price: 32, sku: 'SWEATPANTS-001' }],
  },
  {
    id: 'printify-007',
    title: 'Tote Bag',
    description: 'Durable canvas tote bag with long handles',
    category: 'accessories',
    images: [{ src: 'https://via.placeholder.com/300x300/dddddd/000000?text=Tote' }],
    variants: [{ id: 'v1', title: 'Standard', price: 16, sku: 'TOTE-CANVAS-001' }],
  },
  {
    id: 'printify-008',
    title: 'Beanie',
    description: 'Warm acrylic knit beanie available in multiple colors',
    category: 'apparel',
    images: [{ src: 'https://via.placeholder.com/300x300/888888/ffffff?text=Beanie' }],
    variants: [{ id: 'v1', title: 'One Size', price: 14, sku: 'BEANIE-ACRYLIC-001' }],
  },
  {
    id: 'printify-009',
    title: 'Drawstring Bag',
    description: 'Lightweight drawstring backpack for daily carry',
    category: 'accessories',
    images: [{ src: 'https://via.placeholder.com/300x300/777777/ffffff?text=Drawstring' }],
    variants: [{ id: 'v1', title: 'Standard', price: 18, sku: 'BAG-DRAWSTRING-001' }],
  },
  {
    id: 'printify-010',
    title: 'Polo Shirt',
    description: 'Classic pique cotton polo shirt',
    category: 'apparel',
    images: [{ src: 'https://via.placeholder.com/300x300/1a1a1a/ffffff?text=Polo' }],
    variants: [{ id: 'v1', title: 'Small', price: 28, sku: 'POLO-PIQUE-001' }],
  },
]

/**
 * Fetch products from Printify catalog or return curated fallback
 *
 * Attempts in order:
 * 1. Fetch from real Printify catalog API (if PRINTIFY_API_KEY is set)
 * 2. Return curated fallback products (in mock mode)
 */
export async function fetchPrintifyProducts(): Promise<PrintifyProduct[]> {
  try {
    const client = getPrintifyClient()

    // If in mock mode, return fallback immediately
    if (client.isMockMode()) {
      console.log('[Printify Catalog] Using fallback curated products (mock mode)')
      return CURATED_FALLBACK_PRODUCTS as unknown as PrintifyProduct[]
    }

    // Try to fetch real catalog
    console.log('[Printify Catalog] Fetching products from Printify API...')
    const catalogProducts = await client.getCatalogProducts(100)
    console.log(`[Printify Catalog] Successfully fetched ${catalogProducts.length} catalog products`)

    return catalogProducts as unknown as PrintifyProduct[]
  } catch (error) {
    console.warn(
      '[Printify Catalog] Failed to fetch from API, using fallback curated products:',
      error instanceof Error ? error.message : String(error)
    )
    return CURATED_FALLBACK_PRODUCTS as unknown as PrintifyProduct[]
  }
}

/**
 * Fetch and process Printify products for storefront display
 *
 * Returns:
 * - Filtered and prioritized products (apparel first, then drinkware, then accessories)
 * - Mapped to internal schema with category, images, pricing
 * - Ready for mockup generation
 */
export async function fetchProductsForStorefront(
  primaryColor: string = '#7c3aed',
  secondaryColor: string = '#8fa3b8',
  limit: number = 12
): Promise<MappedProduct[]> {
  try {
    // Fetch from API or fallback
    const products = await fetchPrintifyProducts()

    // Filter and prioritize by category
    const filtered = filterAndPrioritizeProducts(products, limit)

    // Map to internal schema with brand colors
    const mapped = mapPrintifyProducts(filtered, primaryColor, secondaryColor)

    return mapped
  } catch (error) {
    console.error('[Printify Catalog] Error fetching storefront products:', error)
    // Still return some fallback to prevent complete failure
    return mapPrintifyProducts(
      filterAndPrioritizeProducts(CURATED_FALLBACK_PRODUCTS, limit),
      primaryColor,
      secondaryColor
    )
  }
}
