/**
 * Printify Product Mapper — Transforms Printify catalog products into mockup-ready data
 *
 * This utility handles:
 * - Filtering Printify catalog products by category priority
 * - Mapping Printify product schema to our internal product schema
 * - Extracting pricing, images, and metadata
 * - Applying brand colors for mockup generation
 */

export interface PrintifyCatalogProduct {
  id: string
  title: string
  description?: string
  category?: string
  images?: Array<{ src: string; position?: number }>
  variants?: Array<{
    id: string
    title: string
    price: number
    sku?: string
  }>
}

export interface MappedProduct {
  id: string
  title: string
  description: string
  category: 'apparel' | 'drinkware' | 'accessories'
  image: string
  variants: Array<{ id: string; title: string; price: number }>
  sku: string
  primaryColor?: string
  secondaryColor?: string
}

/**
 * Category priority for filtering Printify products
 * Higher priority = returned first
 */
const CATEGORY_PRIORITY: Record<string, number> = {
  'apparel': 0,
  't-shirt': 0,
  'shirt': 0,
  'hoodie': 0,
  'sweatshirt': 0,
  'polo': 0,
  'cap': 0,
  'hat': 0,
  'beanie': 0,
  'jacket': 0,
  'drinkware': 1,
  'mug': 1,
  'cup': 1,
  'tumbler': 1,
  'bottle': 1,
  'water-bottle': 1,
  'accessories': 2,
  'bag': 2,
  'tote': 2,
  'backpack': 2,
  'sticker': 2,
  'patch': 2,
}

/**
 * Get category priority score (lower = higher priority)
 */
function getCategoryPriority(category?: string): number {
  if (!category) return 999
  const normalized = category.toLowerCase().trim()

  // Direct match
  if (normalized in CATEGORY_PRIORITY) {
    return CATEGORY_PRIORITY[normalized]
  }

  // Partial match
  for (const [key, priority] of Object.entries(CATEGORY_PRIORITY)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return priority
    }
  }

  return 999 // Unknown category, low priority
}

/**
 * Get the best image URL from a Printify product
 */
function getBestImage(product: PrintifyCatalogProduct): string {
  // Use first image if available
  if (product.images && product.images.length > 0) {
    const img = product.images[0]
    if (typeof img === 'string') return img
    if ('src' in img) return img.src
  }

  // Fallback placeholder
  return `https://via.placeholder.com/300x300/cccccc/666666?text=${encodeURIComponent(product.title)}`
}

/**
 * Get the first variant or create a default one
 */
function getPrimaryVariant(
  product: PrintifyCatalogProduct
): Array<{ id: string; title: string; price: number }> {
  if (!product.variants || product.variants.length === 0) {
    return [{ id: 'default', title: 'Standard', price: 19.99 }]
  }

  return product.variants.slice(0, 1).map(v => ({
    id: String(v.id),
    title: v.title || 'Standard',
    price: v.price || 19.99,
  }))
}

/**
 * Get SKU from variant or product ID
 */
function getSku(product: PrintifyCatalogProduct): string {
  const variant = product.variants?.[0]
  if (variant?.sku) return variant.sku

  // Generate SKU from product ID
  return `SKU-${product.id.replace(/\W/g, '-').toUpperCase()}`
}

/**
 * Determine primary category from Printify product
 */
function determinePrimaryCategory(
  category?: string
): 'apparel' | 'drinkware' | 'accessories' {
  if (!category) return 'accessories'

  const normalized = category.toLowerCase()

  if (
    normalized.includes('apparel') ||
    normalized.includes('t-shirt') ||
    normalized.includes('shirt') ||
    normalized.includes('hoodie') ||
    normalized.includes('jacket') ||
    normalized.includes('sweat') ||
    normalized.includes('polo') ||
    normalized.includes('hat') ||
    normalized.includes('cap') ||
    normalized.includes('beanie')
  ) {
    return 'apparel'
  }

  if (
    normalized.includes('drinkware') ||
    normalized.includes('mug') ||
    normalized.includes('cup') ||
    normalized.includes('tumbler') ||
    normalized.includes('bottle') ||
    normalized.includes('glass')
  ) {
    return 'drinkware'
  }

  return 'accessories'
}

/**
 * Map a Printify catalog product to our internal product schema
 */
export function mapPrintifyProduct(
  product: PrintifyCatalogProduct,
  primaryColor?: string,
  secondaryColor?: string
): MappedProduct {
  return {
    id: product.id,
    title: product.title,
    description: product.description || `Premium ${product.title.toLowerCase()} with your brand`,
    category: determinePrimaryCategory(product.category),
    image: getBestImage(product),
    variants: getPrimaryVariant(product),
    sku: getSku(product),
    primaryColor,
    secondaryColor,
  }
}

/**
 * Filter and prioritize Printify catalog products
 * Returns products sorted by category priority (apparel → drinkware → accessories)
 */
export function filterAndPrioritizeProducts(
  products: PrintifyCatalogProduct[],
  limit: number = 12
): PrintifyCatalogProduct[] {
  return products
    .sort((a, b) => {
      const aPriority = getCategoryPriority(a.category)
      const bPriority = getCategoryPriority(b.category)
      return aPriority - bPriority
    })
    .slice(0, limit)
}

/**
 * Map a batch of Printify products with brand colors
 */
export function mapPrintifyProducts(
  printifyProducts: PrintifyCatalogProduct[],
  primaryColor: string = '#7c3aed',
  secondaryColor: string = '#8fa3b8'
): MappedProduct[] {
  return printifyProducts.map(p =>
    mapPrintifyProduct(p, primaryColor, secondaryColor)
  )
}
