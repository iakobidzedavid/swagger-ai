// Regression test for cart persistence storefront -> cart -> checkout.
//
// Bug report: "Add to Cart works on /storefront but /cart is EMPTY (state
// not shared) and checkout bounces back." Live-browser testing (Playwright
// against the deployed app + real Supabase/Stripe test-mode) showed the
// happy path already completes end-to-end, but auditing CartContext.tsx
// found two real gaps that would produce exactly the reported symptoms
// under realistic conditions:
//
//  1. No domain scoping: every /storefront/[domain] page shared ONE global
//     cart. Browsing two different companies' storefronts in the same
//     browser session would merge their items into a single cart/order,
//     silently sending products to the wrong company's Printify shop.
//  2. No hydration signal: cart is read from localStorage asynchronously
//     (useEffect, after mount). Consumers treated "not yet loaded" the same
//     as "genuinely empty", so on a slower device/connection /checkout could
//     render its "cart is empty -> Return to Store" bounce screen before the
//     real cart ever loaded.
//
// This test covers the pure logic (src/lib/cart.ts) that now backs
// CartContext.tsx, fixing both gaps.
//
// Run with: npm test (node --test)
import test from 'node:test'
import assert from 'node:assert/strict'

const { addItem, removeItem, updateItemQuantity, clearItems, itemsForDomain, sanitizeLoadedItems, toCart } =
  await import('../src/lib/cart.ts')

const product = (id, price) => ({
  id,
  title: `Product ${id}`,
  sku: `SKU-${id}`,
  image: 'https://example.com/img.png',
  variants: [{ id: 'v1', title: 'Standard', price }],
})

test('addItem scopes by domain — adding the same product on two different storefronts creates two separate lines', () => {
  let items = []
  items = addItem(items, 'acme.com', product('p1', 1999), 'v1', 19.99)
  items = addItem(items, 'other.com', product('p1', 1999), 'v1', 19.99)

  assert.equal(items.length, 2, 'items from two domains must not merge into one line')
  assert.equal(itemsForDomain(items, 'acme.com').length, 1)
  assert.equal(itemsForDomain(items, 'other.com').length, 1)
})

test('addItem merges quantity only within the same domain', () => {
  let items = []
  items = addItem(items, 'acme.com', product('p1', 1999), 'v1', 19.99, 1)
  items = addItem(items, 'acme.com', product('p1', 1999), 'v1', 19.99, 2)
  items = addItem(items, 'other.com', product('p1', 1999), 'v1', 19.99, 5)

  assert.equal(itemsForDomain(items, 'acme.com').length, 1)
  assert.equal(itemsForDomain(items, 'acme.com')[0].quantity, 3)
  assert.equal(itemsForDomain(items, 'other.com')[0].quantity, 5)
})

test('cartForDomain-equivalent (itemsForDomain + toCart) never leaks another storefront\'s items into checkout totals', () => {
  let items = []
  items = addItem(items, 'acme.com', product('p1', 1999), 'v1', 19.99, 1)
  items = addItem(items, 'other.com', product('p2', 5000), 'v1', 50.0, 3)

  const acmeCart = toCart(itemsForDomain(items, 'acme.com'))
  assert.equal(acmeCart.totalItems, 1)
  assert.equal(acmeCart.totalPrice, 19.99)

  const otherCart = toCart(itemsForDomain(items, 'other.com'))
  assert.equal(otherCart.totalItems, 3)
  assert.equal(otherCart.totalPrice, 150.0)
})

test('removeItem and updateItemQuantity only touch the matching domain', () => {
  let items = []
  items = addItem(items, 'acme.com', product('p1', 1999), 'v1', 19.99)
  items = addItem(items, 'other.com', product('p1', 1999), 'v1', 19.99)

  items = updateItemQuantity(items, 'acme.com', 'p1', 'v1', 5)
  assert.equal(itemsForDomain(items, 'acme.com')[0].quantity, 5)
  assert.equal(itemsForDomain(items, 'other.com')[0].quantity, 1, 'other domain unaffected')

  items = removeItem(items, 'acme.com', 'p1', 'v1')
  assert.equal(itemsForDomain(items, 'acme.com').length, 0)
  assert.equal(itemsForDomain(items, 'other.com').length, 1, 'other domain survives removal from acme.com')
})

test('updateItemQuantity with quantity <= 0 removes the line (matches prior removeFromCart-on-zero behavior)', () => {
  let items = addItem([], 'acme.com', product('p1', 1999), 'v1', 19.99)
  items = updateItemQuantity(items, 'acme.com', 'p1', 'v1', 0)
  assert.equal(items.length, 0)
})

test('clearItems(domain) clears only that storefront, leaving other in-progress carts intact', () => {
  let items = []
  items = addItem(items, 'acme.com', product('p1', 1999), 'v1', 19.99)
  items = addItem(items, 'other.com', product('p2', 1999), 'v1', 19.99)

  items = clearItems(items, 'acme.com')
  assert.equal(itemsForDomain(items, 'acme.com').length, 0, 'checkout-completed storefront is cleared')
  assert.equal(itemsForDomain(items, 'other.com').length, 1, 'unrelated storefront cart is untouched')
})

test('clearItems() with no domain clears everything (e.g. full reset)', () => {
  let items = addItem([], 'acme.com', product('p1', 1999), 'v1', 19.99)
  items = clearItems(items)
  assert.equal(items.length, 0)
})

test('sanitizeLoadedItems drops legacy pre-domain-scoping items instead of resurrecting a mixed cart', () => {
  const legacyPayload = {
    items: [
      { productId: 'p1', variantId: 'v1', quantity: 1, product: product('p1', 1999), unitPrice: 19.99 }, // no domain
    ],
  }
  assert.deepEqual(sanitizeLoadedItems(legacyPayload), [])
})

test('sanitizeLoadedItems keeps well-formed domain-tagged items', () => {
  const payload = {
    items: [
      { domain: 'acme.com', productId: 'p1', variantId: 'v1', quantity: 2, product: product('p1', 1999), unitPrice: 19.99 },
    ],
  }
  const result = sanitizeLoadedItems(payload)
  assert.equal(result.length, 1)
  assert.equal(result[0].domain, 'acme.com')
})

test('sanitizeLoadedItems handles garbage/missing input without throwing', () => {
  assert.deepEqual(sanitizeLoadedItems(null), [])
  assert.deepEqual(sanitizeLoadedItems(undefined), [])
  assert.deepEqual(sanitizeLoadedItems({}), [])
  assert.deepEqual(sanitizeLoadedItems({ items: 'not-an-array' }), [])
})
