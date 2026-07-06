/**
 * Storefront fulfillment — completes a `storefront_requests` row that would
 * otherwise sit in 'queued' forever.
 *
 * Root cause: the fast, no-signup /onboard path ("Continue to Store") posts
 * to /api/storefront/request, which only INSERTs a row with status='queued'
 * — it never creates any products, and nothing else in the codebase ever
 * advances that row. The only path that actually creates products
 * (/api/storefront/create) requires a signed-in user + an explicit product
 * selection, which the fast path never goes through. Every domain submitted
 * via the one-click flow (e.g. mercedes.com) was permanently stuck at
 * 'queued', and GET /api/storefront/fetch?domain=... 404s forever because it
 * only matches status='complete'.
 *
 * This module does the same product-creation work /api/storefront/create
 * does (default catalog products instead of a user selection), and is safe
 * to call repeatedly / concurrently:
 *  - No-op if the row is already complete/partial/failed (idempotent).
 *  - "Claims" the row via a conditional UPDATE before doing any work, so two
 *    concurrent callers (e.g. two visitors hitting the storefront page at
 *    once) can't both create duplicate products.
 *  - Also reclaims rows stuck in 'processing' past a staleness window — the
 *    same failure mode STOREFRONT_CREATION_FIX.md documented for the
 *    authenticated path (a crash mid-loop left the row unfinished forever).
 */
import { supabase } from '@/lib/supabase'
import { getPrintifyClient } from '@/lib/printify'
import { fetchProductsForStorefront } from '@/lib/printify-catalog'
import { computeBrandFidelity, computeGenerationSeconds } from '@/lib/competitive-position'
import { createRealMockupBatch, type ProductMockupResult } from '@/lib/printify-mockup'
import { getFaviconUrl } from '@/lib/favicon'

const DEFAULT_PRODUCT_COUNT = 4
const STALE_PROCESSING_MS = 2 * 60 * 1000 // 2 minutes — long enough for a real create loop to finish

export interface FulfillmentResult {
  status: string
  productsCreated: number
}

export async function fulfillStorefrontRequest(requestId: string): Promise<FulfillmentResult> {
  const { data: current } = await supabase
    .from('storefront_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!current) {
    return { status: 'not_found', productsCreated: 0 }
  }

  if (current.status === 'complete' || current.status === 'partial' || current.status === 'failed') {
    const { count } = await supabase
      .from('printify_products')
      .select('id', { count: 'exact', head: true })
      .eq('storefront_request_id', requestId)
    return { status: current.status, productsCreated: count ?? 0 }
  }

  const isStaleProcessing =
    current.status === 'processing' &&
    Date.now() - new Date(current.updated_at ?? current.created_at).getTime() > STALE_PROCESSING_MS

  if (current.status === 'processing' && !isStaleProcessing) {
    // Actively being worked on right now by another request — don't double-create.
    return { status: current.status, productsCreated: 0 }
  }

  // Claim the row: conditional update only succeeds if it's still in the
  // status we observed. If a concurrent caller already claimed it, this
  // matches 0 rows and we back off instead of creating duplicate products.
  const { data: claimed } = await supabase
    .from('storefront_requests')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', isStaleProcessing ? 'processing' : 'queued')
    .select()
    .single()

  if (!claimed) {
    return { status: 'processing', productsCreated: 0 }
  }

  const printifyClient = getPrintifyClient()
  const shopId = printifyClient.isMockMode()
    ? `mock-shop-${claimed.domain.replace(/\./g, '-')}`
    : `shop-${claimed.id}`

  const primaryColor = claimed.primary_color || '#7c3aed'
  const secondaryColor = claimed.secondary_color || '#8fa3b8'

  let productsCreated = 0
  const failedProducts: Array<{ productId: string; error: string }> = []

  try {
    const catalogProducts = await fetchProductsForStorefront(primaryColor, secondaryColor, DEFAULT_PRODUCT_COUNT)
    const selectedProducts = catalogProducts.slice(0, DEFAULT_PRODUCT_COUNT)

    // Real Printify mockups: this is the fast, no-signup self-serve path
    // (/onboard → "Continue to Store") — the actual flow the DE-22 MVBP demo
    // runs. When PRINTIFY_API_KEY is a real token (not mock mode), try to
    // create REAL Printify products with the brand logo uploaded as a print
    // file and let Printify render the mockup photo itself, instead of
    // relying on the frontend's CSS logo-sticker overlay on a stock photo.
    // Best-effort: any product that can't get a real mockup falls back to
    // the existing stock-photo + CSS-overlay behavior below.
    let realMockups = new Map<string, ProductMockupResult>()
    if (!printifyClient.isMockMode()) {
      try {
        const batch = await createRealMockupBatch({
          apiKey: process.env.PRINTIFY_API_KEY!,
          logoImageUrl: claimed.logo_url,
          faviconFallbackUrl: getFaviconUrl(claimed.domain),
          domain: claimed.domain,
          products: selectedProducts.map(p => ({
            id: p.id,
            category: p.category,
            title: p.title,
            priceUsd: p.variants[0]?.price ? p.variants[0].price / 100 : undefined,
          })),
        })
        if (batch.enabled) {
          realMockups = new Map(batch.results.map(r => [r.id, r]))
        } else {
          console.warn('[storefront-fulfillment] Real Printify mockups unavailable:', batch.reason)
        }
      } catch (err) {
        console.warn('[storefront-fulfillment] createRealMockupBatch failed, falling back to stock photos:', err)
      }
    }

    for (const product of selectedProducts) {
      try {
        const variant = product.variants[0]
        const priceCents = variant?.price ?? 1999
        const realMockup = realMockups.get(product.id)

        if (realMockup?.success) {
          // Real Printify product was created and rendered a real mockup —
          // persist it directly, no stock-photo fallback needed.
          const { error: insertError } = await supabase.from('printify_products').insert({
            storefront_request_id: claimed.id,
            printify_id: realMockup.printifyProductId,
            name: product.title,
            description: product.description,
            category: product.category,
            image_url: realMockup.mockupImageUrl,
            mockup_image_url: realMockup.mockupImageUrl,
            is_real_mockup: true,
            printify_blueprint_id: realMockup.blueprintId,
            printify_print_provider_id: realMockup.printProviderId,
            printify_variant_id: realMockup.variantId,
            price_usd: priceCents / 100,
            sku: product.sku,
            brand_color_primary: primaryColor,
            brand_color_secondary: secondaryColor,
            status: 'active',
          })

          if (insertError) {
            console.error('[storefront-fulfillment] real-mockup product insert error:', insertError)
            failedProducts.push({ productId: product.id, error: insertError.message })
          } else {
            productsCreated++
          }
          continue
        }

        if (realMockup && !realMockup.success) {
          console.warn(
            `[storefront-fulfillment] Real mockup failed for "${product.title}", falling back to stock photo:`,
            realMockup.error
          )
        }

        const productData = {
          title: product.title,
          description: product.description,
          images: [{ src: product.image }],
          variants: [
            {
              id: 1,
              title: variant?.title || 'Default',
              price: priceCents,
              sku: product.sku,
            },
          ],
          print_areas: [{ id: 'front', title: 'Front Print' }],
        }

        let printifyResponse
        try {
          printifyResponse = await printifyClient.createProduct(shopId, productData)
        } catch (printifyError) {
          // Same resilience as /api/storefront/create: a real API key with no
          // registered shop (or a transient failure) falls back to a mock
          // product record rather than failing the whole storefront.
          if (!printifyClient.isMockMode()) {
            console.warn('[storefront-fulfillment] Printify API error, using mock response:', printifyError)
          }
          printifyResponse = {
            id: `mock-product-${product.id}-${Date.now()}`,
            title: product.title,
            description: productData.description,
            images: productData.images,
            variants: productData.variants,
            status: 'draft',
          }
        }

        const { error: insertError } = await supabase.from('printify_products').insert({
          storefront_request_id: claimed.id,
          printify_id: printifyResponse.id,
          name: product.title,
          description: productData.description,
          category: product.category,
          image_url: product.image,
          is_real_mockup: false,
          price_usd: priceCents / 100,
          sku: product.sku,
          brand_color_primary: primaryColor,
          brand_color_secondary: secondaryColor,
          status: 'active',
        })

        if (insertError) {
          console.error('[storefront-fulfillment] product insert error:', insertError)
          failedProducts.push({ productId: product.id, error: insertError.message })
        } else {
          productsCreated++
        }
      } catch (err) {
        console.error('[storefront-fulfillment] error creating product:', err)
        failedProducts.push({
          productId: product.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  } catch (err) {
    console.error('[storefront-fulfillment] error fetching catalog products:', err)
  }

  const finalStatus =
    productsCreated === 0 ? 'failed' : failedProducts.length === 0 ? 'complete' : 'partial'

  const generationSeconds = computeGenerationSeconds(claimed.created_at)
  const { pct: brandFidelityPct, breakdown: brandFidelityBreakdown } = computeBrandFidelity({
    logoUrl: claimed.logo_url,
    primaryColor,
    secondaryColor,
    productsRequested: DEFAULT_PRODUCT_COUNT,
    productsCreated,
  })

  await supabase
    .from('storefront_requests')
    .update({
      status: finalStatus,
      updated_at: new Date().toISOString(),
      generation_seconds: generationSeconds,
      brand_fidelity_pct: brandFidelityPct,
      brand_fidelity_breakdown: brandFidelityBreakdown,
    })
    .eq('id', claimed.id)

  return { status: finalStatus, productsCreated }
}
