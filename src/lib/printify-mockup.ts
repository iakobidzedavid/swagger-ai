/**
 * Real Printify Mockup Generator
 *
 * Creates an ACTUAL Printify product with the brand logo uploaded as a real
 * print file, and returns Printify's own rendered mockup photo — the same
 * mechanism Printify's own product editor uses. This replaces the old
 * CSS-overlay approach (see ProductPhotoOverlay), which pasted a translucent
 * logo chip on top of a static catalog stock photo via absolute-positioned
 * CSS. That overlay had no idea where a shirt's chest or a mug's face
 * actually was in the photo, so the chip could land anywhere — including on
 * a model's face. A real Printify product places the logo in an actual
 * print area on the actual garment, and Printify's renderer returns a photo
 * with the logo really printed on it.
 *
 * Uses the account-level PRINTIFY_API_KEY (a Printify personal access token)
 * to:
 *   1. Resolve the real shop tied to that token      — GET /shops.json
 *   2. Upload the brand logo as a print-ready image  — POST /uploads/images.json
 *   3. Pick a real blueprint + print provider + variant for the requested
 *      product category                              — GET /catalog/blueprints.json (+ providers/variants)
 *   4. Create a real product with print_areas placing the uploaded logo
 *   5. Return Printify's own rendered mockup image from the product response
 *
 * Every step is best-effort: if the shop, logo upload, or a specific
 * product's blueprint match fails, callers fall back to the existing stock
 * catalog photo + CSS overlay behavior rather than breaking storefront
 * generation entirely.
 */

const PRINTIFY_BASE_URL = 'https://api.printify.com/v1'

interface PrintifyFetchResult<T> {
  status: number
  ok: boolean
  body: T
}

async function printifyFetch<T = unknown>(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<PrintifyFetchResult<T>> {
  const res = await fetch(`${PRINTIFY_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const status = res.status
  const body = (await res.json().catch(() => null)) as T
  return { status, ok: res.ok, body }
}

interface Blueprint {
  id: number
  title: string
}
interface PrintProvider {
  id: number
  title: string
}
interface Variant {
  id: number
  title: string
  is_enabled?: boolean
}
interface CreatedPrintifyProduct {
  id: string | number
  title: string
  images?: Array<{ src: string; is_default?: boolean }>
}

// Ordered keyword candidates per category, matched against real Printify
// blueprint titles (from GET /catalog/blueprints.json). The product's own
// title is tried first (e.g. a "Hoodie" product tries 'hoodie' before
// falling through the rest of the apparel list), so a mismatch in one SKU
// doesn't cascade into every apparel SKU rendering as a t-shirt.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  apparel: [
    'heavy cotton tee',
    'hoodie',
    'crewneck sweatshirt',
    'polo',
    'snapback',
    'dad cap',
    'beanie',
    'tank top',
    'sweatpants',
  ],
  drinkware: ['mug', 'insulated bottle', 'water bottle', 'tumbler'],
  accessories: ['tote bag', 'drawstring', 'phone case', 'notebook', 'sticker'],
}

function keywordsForProduct(category: string, title: string): string[] {
  const normalizedCategory = (category || '').toLowerCase().trim()
  const list = CATEGORY_KEYWORDS[normalizedCategory] || CATEGORY_KEYWORDS.accessories
  const titleLower = title.toLowerCase()
  const prioritized = list.filter(k => titleLower.includes(k.split(' ')[0]))
  const rest = list.filter(k => !prioritized.includes(k))
  return [...prioritized, ...rest]
}

interface ProductMockupRequest {
  /** Internal identifier (our own product id) to correlate the result back. */
  id: string
  category: string
  title: string
  priceUsd?: number
}

export interface ProductMockupResult {
  id: string
  success: boolean
  mockupImageUrl?: string
  printifyProductId?: string
  blueprintId?: string
  printProviderId?: string
  variantId?: string
  error?: string
}

interface RealMockupBatchResult {
  /** False when no real mockups could be attempted at all (no shop / no logo upload / no catalog). */
  enabled: boolean
  shopId?: string
  shopTitle?: string
  uploadedImageId?: string
  reason?: string
  results: ProductMockupResult[]
}

/**
 * Resolve the shop associated with a Printify personal access token.
 * Personal access tokens list the account's own shop(s) directly — no OAuth
 * dance required — so this works for the admin-owned PRINTIFY_API_KEY.
 */
async function resolveRealShop(apiKey: string): Promise<{ id: number; title: string } | null> {
  const resp = await printifyFetch<Array<{ id: number; title: string }>>('/shops.json', apiKey)
  if (!resp.ok || !Array.isArray(resp.body) || resp.body.length === 0) {return null}
  return resp.body[0]
}

/** Upload a brand logo (by URL) to Printify as a print-ready image, returning its upload id. */
async function uploadLogoImage(apiKey: string, fileName: string, imageUrl: string): Promise<string | null> {
  const resp = await printifyFetch<{ id?: string }>('/uploads/images.json', apiKey, {
    method: 'POST',
    body: JSON.stringify({ file_name: fileName, url: imageUrl }),
  })
  return resp.ok ? resp.body?.id ?? null : null
}

/**
 * Create real Printify products (one per requested SKU) with the uploaded
 * brand logo placed as the front print, and return Printify's own rendered
 * mockup photo for each. Resolves the shop, uploads the logo, and fetches
 * the live blueprint catalog ONCE, then reuses them across every product in
 * the batch.
 */
export async function createRealMockupBatch(params: {
  apiKey: string
  /** Detected brand logo URL (Brandfetch/theme-color/Clearbit). Falls back to a favicon URL if absent. */
  logoImageUrl: string | null
  faviconFallbackUrl: string
  domain: string
  products: ProductMockupRequest[]
}): Promise<RealMockupBatchResult> {
  const { apiKey, logoImageUrl, faviconFallbackUrl, domain, products } = params

  const shop = await resolveRealShop(apiKey)
  if (!shop) {
    return { enabled: false, reason: 'no_printify_shop', results: [] }
  }

  const uploadUrl = logoImageUrl || faviconFallbackUrl
  const uploadedImageId = await uploadLogoImage(apiKey, `${domain}-logo.png`, uploadUrl)
  if (!uploadedImageId) {
    return { enabled: false, shopId: String(shop.id), shopTitle: shop.title, reason: 'logo_upload_failed', results: [] }
  }

  const blueprintsResp = await printifyFetch<Blueprint[]>('/catalog/blueprints.json', apiKey)
  const blueprints = Array.isArray(blueprintsResp.body) ? blueprintsResp.body : []
  if (blueprints.length === 0) {
    return {
      enabled: false,
      shopId: String(shop.id),
      shopTitle: shop.title,
      uploadedImageId,
      reason: 'no_blueprints',
      results: [],
    }
  }

  const results = await Promise.all(
    products.map(async product => {
      const keywords = keywordsForProduct(product.category, product.title)
      let lastError = 'No matching blueprint/provider/variant found'

      for (const keyword of keywords) {
        const blueprint = blueprints.find(bp => bp.title?.toLowerCase().includes(keyword))
        if (!blueprint) {continue}

        try {
          const providersResp = await printifyFetch<PrintProvider[]>(
            `/catalog/blueprints/${blueprint.id}/print_providers.json`,
            apiKey
          )
          const providers = Array.isArray(providersResp.body) ? providersResp.body : []
          const provider = providers[0]
          if (!provider) {
            lastError = `No print provider for blueprint ${blueprint.id}`
            continue
          }

          const variantsResp = await printifyFetch<{ variants?: Variant[] }>(
            `/catalog/blueprints/${blueprint.id}/print_providers/${provider.id}/variants.json`,
            apiKey
          )
          const variantList = Array.isArray(variantsResp.body?.variants) ? variantsResp.body!.variants! : []
          const variant = variantList.find(v => v.is_enabled !== false) || variantList[0]
          if (!variant) {
            lastError = `No variant for blueprint ${blueprint.id}/provider ${provider.id}`
            continue
          }

          const priceCents = Math.round((product.priceUsd ?? 19.99) * 100)
          const createResp = await printifyFetch<CreatedPrintifyProduct>(`/shops/${shop.id}/products.json`, apiKey, {
            method: 'POST',
            body: JSON.stringify({
              title: product.title,
              description: `${product.title} — custom branded merchandise for your team`,
              blueprint_id: blueprint.id,
              print_provider_id: provider.id,
              variants: [{ id: variant.id, price: priceCents, is_enabled: true }],
              print_areas: [
                {
                  variant_ids: [variant.id],
                  placeholders: [
                    { position: 'front', images: [{ id: uploadedImageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
                  ],
                },
              ],
            }),
          })

          if (!createResp.ok) {
            lastError = `Printify create-product [${createResp.status}]`
            continue
          }

          const createdProduct = createResp.body
          const mockup = createdProduct.images?.find(i => i.is_default) || createdProduct.images?.[0]
          if (!mockup?.src) {
            lastError = 'Printify product created but returned no mockup image'
            continue
          }

          return {
            id: product.id,
            success: true,
            mockupImageUrl: mockup.src,
            printifyProductId: String(createdProduct.id),
            blueprintId: String(blueprint.id),
            printProviderId: String(provider.id),
            variantId: String(variant.id),
          } satisfies ProductMockupResult
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err)
        }
      }

      return { id: product.id, success: false, error: lastError } satisfies ProductMockupResult
    })
  )

  return { enabled: true, shopId: String(shop.id), shopTitle: shop.title, uploadedImageId, results }
}
