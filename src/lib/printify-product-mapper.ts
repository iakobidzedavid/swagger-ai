/**
 * Printify Product Mapper — Transforms Printify catalog products into mockup-ready data
 *
 * This utility handles:
 * - Filtering Printify catalog products by category priority
 * - Mapping Printify product schema to our internal product schema
 * - Extracting pricing, images, and metadata
 * - Applying brand colors for mockup generation
 */

interface PrintifyCatalogProduct {
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
  if (!category) {return 999}
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
    if (typeof img === 'string') {return img}
    if ('src' in img && img.src) {return img.src}
  }

  // Last-resort fallback — a real local asset (not a third-party placeholder
  // service, which can go dark at any time and render as a broken image).
  return '/product-placeholder.svg'
}

/**
 * Strip HTML tags from a Printify catalog description (real blueprint
 * descriptions come back as marketing HTML with <p>/<div>/<br> markup) and
 * collapse whitespace so it reads as plain copy on a product card.
 *
 * Also removes hex color codes and metadata patterns like "Branded with colors: #XXXXXX"
 * that contaminate product descriptions.
 *
 * Exported so printify-catalog.ts can reuse it when normalizing rows read
 * back from the printify_products table (see normalizeStoredProduct).
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    // Remove hex color codes and metadata patterns like "Branded with colors: #XXXXXX"
    .replace(/(?:^|\s)[-–—]*\s*(?:Branded\s+)?with\s+colors?\s*:?\s*#[0-9a-fA-F]{6}(?:\s|$)/gi, ' ')
    // Remove standalone hex codes (but keep them in hex color formats like #123456 unless they're metadata)
    .replace(/\b#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?:\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Get the first variant or create a default one
 * Prices are stored in dollars in the DB and catalog; convert to cents here.
 */
function getPrimaryVariant(
  product: PrintifyCatalogProduct
): Array<{ id: string; title: string; price: number }> {
  if (!product.variants || product.variants.length === 0) {
    return [{ id: 'default', title: 'Standard', price: 1999 }] // $19.99 in cents
  }

  return product.variants.slice(0, 1).map(v => ({
    id: String(v.id),
    title: v.title || 'Standard',
    price: Math.round((v.price || 19.99) * 100), // Convert dollars to cents
  }))
}

/**
 * Get SKU from variant or product ID
 */
function getSku(product: PrintifyCatalogProduct): string {
  const variant = product.variants?.[0]
  if (variant?.sku) {return variant.sku}

  // Generate SKU from product ID
  return `SKU-${product.id.replace(/\W/g, '-').toUpperCase()}`
}

/**
 * Determine primary category from Printify product
 */
export function determinePrimaryCategory(
  category?: string
): 'apparel' | 'drinkware' | 'accessories' {
  if (!category) {return 'accessories'}

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
 *
 * Real Printify catalog blueprints (from /catalog/blueprints.json) have no
 * `category` field — only title/brand/model — so category priority and
 * apparel/drinkware/accessories classification both fall back to matching
 * against the title when `category` is absent. A title is always required:
 * if a product ever arrives without one, it gets a visible fallback instead
 * of rendering as blank copy.
 */
function mapPrintifyProduct(
  product: PrintifyCatalogProduct,
  primaryColor?: string,
  secondaryColor?: string
): MappedProduct {
  const title = product.title?.trim() || 'Custom Product'
  const rawDescription = product.description?.trim()
  const description = rawDescription
    ? stripHtml(rawDescription).slice(0, 180)
    : `Premium ${title.toLowerCase()} with your brand`

  return {
    id: product.id,
    title,
    description,
    category: determinePrimaryCategory(product.category || title),
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
      const aPriority = getCategoryPriority(a.category || a.title)
      const bPriority = getCategoryPriority(b.category || b.title)
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
