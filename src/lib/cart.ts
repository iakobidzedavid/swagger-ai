// Pure, framework-free cart logic extracted out of CartContext.tsx so it can
// be unit-tested directly (see tests/cart.test.mjs) instead of only being
// exercised indirectly through React component rendering.
//
// Every operation here is scoped by `domain` (the storefront/company a line
// item was added from). The app is multi-tenant — /storefront/[domain] pages
// for different companies all share one localStorage-backed cart — so
// without domain scoping, adding items from two different companies' stores
// in the same browser session would merge into a single cart/order and
// silently ship the wrong products against the wrong company's Printify shop.

export interface CartProduct {
  id: string
  title: string
  sku: string
  image: string
  variants: Array<{ id: string; title: string; price: number }>
}

export interface CartItem {
  domain: string
  productId: string
  variantId: string
  quantity: number
  product: CartProduct
  unitPrice: number
}

export interface Cart {
  items: CartItem[]
  totalItems: number
  totalPrice: number
}

function calculateTotals(items: CartItem[]): { totalItems: number; totalPrice: number } {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  return { totalItems, totalPrice }
}

export function toCart(items: CartItem[]): Cart {
  const { totalItems, totalPrice } = calculateTotals(items)
  return { items, totalItems, totalPrice }
}

function isSameLine(item: CartItem, domain: string, productId: string, variantId: string): boolean {
  return item.domain === domain && item.productId === productId && item.variantId === variantId
}

export function addItem(
  items: CartItem[],
  domain: string,
  product: CartProduct,
  variantId: string,
  unitPrice: number,
  quantity: number = 1
): CartItem[] {
  const existingItem = items.find(item => isSameLine(item, domain, product.id, variantId))

  if (existingItem) {
    return items.map(item =>
      isSameLine(item, domain, product.id, variantId)
        ? { ...item, quantity: item.quantity + quantity }
        : item
    )
  }

  return [...items, { domain, productId: product.id, variantId, quantity, product, unitPrice }]
}

export function removeItem(items: CartItem[], domain: string, productId: string, variantId: string): CartItem[] {
  return items.filter(item => !isSameLine(item, domain, productId, variantId))
}

export function updateItemQuantity(
  items: CartItem[],
  domain: string,
  productId: string,
  variantId: string,
  quantity: number
): CartItem[] {
  if (quantity <= 0) {
    return removeItem(items, domain, productId, variantId)
  }
  return items.map(item => (isSameLine(item, domain, productId, variantId) ? { ...item, quantity } : item))
}

export function clearItems(items: CartItem[], domain?: string): CartItem[] {
  if (!domain) return []
  // Clear only this storefront's items so an in-progress cart for another
  // company (opened in another tab, same browser) survives.
  return items.filter(item => item.domain !== domain)
}

export function itemsForDomain(items: CartItem[], domain: string): CartItem[] {
  return items.filter(item => item.domain === domain)
}

/**
 * Sanitize whatever was pulled out of localStorage. Items saved before
 * domain-scoping was added have no `domain` field — we can't safely guess
 * which storefront they belonged to, so drop them rather than risk
 * resurrecting a cross-storefront mixed cart.
 */
export function sanitizeLoadedItems(raw: unknown): CartItem[] {
  const items = (raw as { items?: unknown } | null | undefined)?.items
  if (!Array.isArray(items)) return []
  return items.filter(
    (item): item is CartItem =>
      !!item && typeof item.domain === 'string' && item.domain.length > 0
  )
}
