/**
 * Printify Catalog Fetcher — Safe wrapper for fetching Printify products
 *
 * Attempts to fetch real products from Printify catalog when API key available.
 * Falls back to curated products when in mock mode or API is unavailable.
 */

import { getPrintifyClient, type PrintifyProduct } from './printify'
import { filterAndPrioritizeProducts, mapPrintifyProducts, type MappedProduct } from './printify-product-mapper'

/**
 * Curated fallback products — used only when the live Printify catalog API is
 * unreachable (network failure) or no PRINTIFY_API_KEY is configured.
 *
 * These are REAL Printify catalog blueprints (real product photography served
 * from Printify's own CDN, real titles/brand/model — captured from
 * GET /catalog/blueprints.json), not synthetic placeholders. Previously this
 * fallback pointed at via.placeholder.com, a service that has been shut down
 * (returns no response at all) — every fallback product rendered as a broken
 * image. Swapping in real, verified-loading Printify CDN image URLs fixes that
 * without requiring a network call at request time.
 */
export const CURATED_FALLBACK_PRODUCTS = [
  {
    id: 'printify-006',
    title: 'Unisex Heavy Cotton Tee',
    description: 'Gildan 5000 — 100% cotton tee, tightly knit for sharp, long-lasting print detail.',
    category: 'apparel',
    images: [{ src: 'https://images.printify.com/66d81786ae1f0775ec0aef82' }],
    variants: [{ id: 'v1', title: 'Small', price: 18, sku: 'TSHIRT-UNISEX-001' }],
  },
  {
    id: 'printify-092',
    title: 'Unisex College Hoodie',
    description: 'AWDIS JH001 — classic pullover hoodie with side seams that hold its shape wash after wash.',
    category: 'apparel',
    images: [{ src: 'https://images.printify.com/66c43c6cbbde44677a041c24' }],
    variants: [{ id: 'v1', title: 'Small', price: 42, sku: 'HOODIE-UNISEX-001' }],
  },
  {
    id: 'printify-068',
    title: 'Mug 11oz',
    description: 'Classic white ceramic mug in the most popular size, built for durable sublimation printing.',
    category: 'drinkware',
    images: [{ src: 'https://images.printify.com/66c42e5361b2691da8085442' }],
    variants: [{ id: 'v1', title: 'Standard', price: 12, sku: 'MUG-11OZ-001' }],
  },
  {
    id: 'printify-482',
    title: '20oz Insulated Bottle',
    description: 'Stainless steel, spill-proof screw-on cap — an eco-friendly swap for single-use plastic.',
    category: 'drinkware',
    images: [{ src: 'https://images.printify.com/66d5c1f99d176ab4d20610a2' }],
    variants: [{ id: 'v1', title: 'Standard', price: 24, sku: 'BOTTLE-20OZ-001' }],
  },
  {
    id: 'printify-1447',
    title: 'Classic Dad Cap',
    description: 'Yupoong 6245CM — timeless 100% cotton dad cap, built for everyday comfort.',
    category: 'apparel',
    images: [{ src: 'https://images.printify.com/66c4719a26c12b30ed07acc2' }],
    variants: [{ id: 'v1', title: 'One Size', price: 20, sku: 'CAP-6PANEL-001' }],
  },
  {
    id: 'printify-1398',
    title: 'Unisex Sweatpants',
    description: 'Gildan 18200 — heavy blend sweatpants, soft enough to lounge in, durable enough for daily wear.',
    category: 'apparel',
    images: [{ src: 'https://images.printify.com/69fc63dd1ba1caad070c2750' }],
    variants: [{ id: 'v1', title: 'Small', price: 32, sku: 'SWEATPANTS-001' }],
  },
  {
    id: 'printify-507',
    title: 'Canvas Tote Bag, 5-Color Straps',
    description: 'Lightweight polyester canvas tote with a sleek lined interior, built for picture-perfect prints.',
    category: 'accessories',
    images: [{ src: 'https://images.printify.com/66d5c839de3247673e010573' }],
    variants: [{ id: 'v1', title: 'Standard', price: 16, sku: 'TOTE-CANVAS-001' }],
  },
  {
    id: 'printify-1691',
    title: 'Classic Cuffed Beanie',
    description: 'Yupoong 1501KC — hypoallergenic acrylic beanie with a classic 12" cuffed design.',
    category: 'apparel',
    images: [{ src: 'https://images.printify.com/67e27a4665b07e8bc90a9462' }],
    variants: [{ id: 'v1', title: 'One Size', price: 14, sku: 'BEANIE-ACRYLIC-001' }],
  },
  {
    id: 'printify-414',
    title: 'Drawstring Bag',
    description: 'Lightweight, durable drawstring bag for the gym, the store, or the beach.',
    category: 'accessories',
    images: [{ src: 'https://images.printify.com/66d8359f9935bc2b42015826' }],
    variants: [{ id: 'v1', title: 'Standard', price: 18, sku: 'BAG-DRAWSTRING-001' }],
  },
  {
    id: 'printify-1129',
    title: "Men's Sport Polo Shirt",
    description: 'Sport-Tek ST650 — 100% soft polyester polo built for performance and everyday style.',
    category: 'apparel',
    images: [{ src: 'https://images.printify.com/66d58cd37dd31e0a3b0ecd1d' }],
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
