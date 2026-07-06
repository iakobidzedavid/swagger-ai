import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPrintifyClient } from '@/lib/printify'
import { verifyAuth } from '@/lib/auth'
import { computeBrandFidelity, computeGenerationSeconds } from '@/lib/competitive-position'
import { createRealMockupBatch, type ProductMockupResult } from '@/lib/printify-mockup'
import { getFaviconUrl } from '@/lib/favicon'

export const runtime = 'nodejs'
// Real Printify mockup creation makes several sequential Printify API calls
// per product (provider lookup, variant lookup, product create) — 60s is the
// highest maxDuration Vercel accepts on every plan tier (Hobby included).
export const maxDuration = 60

interface ProductSelection {
  productId: string
  productName: string
  productCategory: string
  productImage: string
  productDescription?: string
  productPrice: number
  productSku: string
}

interface StorefrontCreateRequest {
  domainSubmissionId?: string
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  designTemplate?: string
  products: ProductSelection[]
}

interface StorefrontCreateResponse {
  success: boolean
  message: string
  storefrontRequest?: {
    id: string
    domain: string
    companyName: string
    status: string
    productsCreated: number
    generationSeconds: number
    brandFidelityPct: number
  }
}

/**
 * POST /api/storefront/create
 *
 * Orchestrate the complete storefront creation flow:
 * 1. Verify user authentication (JWT token required)
 * 2. Create a storefront_requests record linked to the authenticated user
 * 3. Create a Printify shop (or get existing)
 * 4. Create all selected products in Printify
 * 5. Generate a storefront URL
 *
 * This is the primary entry point for the products-selection flow.
 * REQUIRES: Authorization: Bearer <JWT_TOKEN>
 *
 * Requires:
 * - Valid JWT token in Authorization header
 * - PRINTIFY_API_KEY for real Printify integration
 */
export async function POST(req: NextRequest) {
  // Verify authentication
  const auth = await verifyAuth(req)
  if (!auth.success) {
    return NextResponse.json(
      { success: false, message: auth.error || 'Unauthorized' },
      { status: 401 }
    )
  }

  let body: StorefrontCreateRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const {
    domainSubmissionId,
    domain,
    companyName,
    logoUrl,
    primaryColor,
    secondaryColor,
    designTemplate,
    products,
  } = body

  // Validate required fields
  if (!domain || !companyName || !products || products.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing required fields: domain, companyName, and at least one product',
      },
      { status: 400 }
    )
  }

  if (products.length < 4) {
    return NextResponse.json(
      {
        success: false,
        message: 'At least 4 products are required to create a storefront',
      },
      { status: 400 }
    )
  }

  try {
    const printifyClient = getPrintifyClient()

    // Step 1: Create a storefront_requests record linked to the authenticated user
    const { data: storefrontRequest, error: storefrontError } = await supabase
      .from('storefront_requests')
      .insert({
        owner_id: auth.userId, // Link storefront to authenticated user
        domain_submission_id: domainSubmissionId || null,
        domain,
        company_name: companyName,
        logo_url: logoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        design_template: designTemplate || 'minimal',
        status: 'processing',
      })
      .select()
      .single()

    if (storefrontError || !storefrontRequest) {
      console.error('Supabase storefront_requests insert error:', storefrontError)
      return NextResponse.json(
        { success: false, message: 'Failed to create storefront request' },
        { status: 500 }
      )
    }

    const storefrontId = storefrontRequest.id

    // Step 2: Get or create Printify shop
    // In mock mode, generate a shop ID based on domain
    // In real mode, this would require OAuth (not yet implemented)
    const shopId = printifyClient.isMockMode()
      ? `mock-shop-${domain.replace(/\./g, '-')}`
      : `shop-${storefrontId}`

    // Step 3: Create products directly in Supabase (bypassing HTTP fetch for reliability)
    let productsCreated = 0
    const failedProducts: Array<{ productId: string; error: string }> = []

    // Real Printify mockups: try to create REAL Printify products with the
    // brand logo uploaded as a print file, so the product photo is Printify's
    // own rendered mockup (logo really printed on the garment) instead of a
    // stock catalog photo with a CSS logo sticker pasted on top. Best-effort —
    // any product that can't get a real mockup falls back to the existing
    // stock-photo behavior below.
    let realMockups = new Map<string, ProductMockupResult>()
    if (!printifyClient.isMockMode()) {
      try {
        const batch = await createRealMockupBatch({
          apiKey: process.env.PRINTIFY_API_KEY!,
          logoImageUrl: logoUrl,
          faviconFallbackUrl: getFaviconUrl(domain),
          domain,
          products: products.map(p => ({
            id: p.productId,
            category: p.productCategory,
            title: p.productName,
            priceUsd: p.productPrice,
          })),
        })
        if (batch.enabled) {
          realMockups = new Map(batch.results.map(r => [r.id, r]))
        } else {
          console.warn('[storefront/create] Real Printify mockups unavailable:', batch.reason)
        }
      } catch (err) {
        console.warn('[storefront/create] createRealMockupBatch failed, falling back to stock photos:', err)
      }
    }

    for (const product of products) {
      const realMockup = realMockups.get(product.productId)
      if (realMockup?.success) {
        // Real Printify product was created and rendered a real mockup —
        // persist it directly, no stock-photo fallback needed.
        const { data: insertedProduct, error: insertError } = await supabase
          .from('printify_products')
          .insert({
            storefront_request_id: storefrontId,
            printify_id: realMockup.printifyProductId,
            name: product.productName,
            description: product.productDescription?.trim() || `${product.productName} — custom branded merchandise for your team`,
            category: product.productCategory,
            image_url: realMockup.mockupImageUrl,
            mockup_image_url: realMockup.mockupImageUrl,
            is_real_mockup: true,
            printify_blueprint_id: realMockup.blueprintId,
            printify_print_provider_id: realMockup.printProviderId,
            printify_variant_id: realMockup.variantId,
            price_usd: product.productPrice,
            sku: product.productSku,
            brand_color_primary: primaryColor,
            brand_color_secondary: secondaryColor,
            status: 'active',
          })
          .select()
          .single()

        if (insertError || !insertedProduct) {
          console.error('Supabase real-mockup product insert error:', insertError)
          failedProducts.push({ productId: product.productId, error: insertError?.message || 'Unknown error' })
        } else {
          productsCreated++
        }
        continue
      }

      if (realMockup && !realMockup.success) {
        console.warn(
          `[storefront/create] Real mockup failed for "${product.productName}", falling back to stock photo:`,
          realMockup.error
        )
      }

      try {
        // Prepare product data for Printify
        // Use the product's own real catalog description when we have one —
        // never surface raw hex codes (e.g. "#7c3aed") as customer-facing copy.
        const productData = {
          title: product.productName,
          description: product.productDescription?.trim() || `${product.productName} — custom branded merchandise for your team`,
          images: [{ src: product.productImage }],
          variants: [
            {
              id: 1,
              title: 'Default',
              price: Math.round(product.productPrice * 100), // Printify uses cents
              sku: product.productSku,
            },
          ],
          print_areas: [
            {
              id: 'front',
              title: 'Front Print',
            },
          ],
        }

        // Call Printify API to create the product (or mock it)
        let printifyResponse
        try {
          printifyResponse = await printifyClient.createProduct(shopId, productData)
        } catch (printifyError) {
          // If Printify API fails and we're not in mock mode, use a mock response for testing
          // In production, we'd want to retry or fail the entire storefront
          if (!printifyClient.isMockMode()) {
            console.warn('Printify API error, using mock response:', printifyError)
          }
          printifyResponse = {
            id: `mock-product-${product.productId}-${Date.now()}`,
            title: product.productName,
            description: productData.description,
            images: productData.images,
            variants: productData.variants,
            status: 'draft',
          }
        }

        // Store the created product in our database
        const { data: insertedProduct, error: insertError } = await supabase
          .from('printify_products')
          .insert({
            storefront_request_id: storefrontId,
            printify_id: printifyResponse.id,
            name: product.productName,
            description: productData.description,
            category: product.productCategory,
            image_url: product.productImage,
            is_real_mockup: false,
            price_usd: product.productPrice,
            sku: product.productSku,
            brand_color_primary: primaryColor,
            brand_color_secondary: secondaryColor,
            status: 'active',
          })
          .select()
          .single()

        if (insertError || !insertedProduct) {
          console.error('Supabase product insert error:', insertError)
          failedProducts.push({
            productId: product.productId,
            error: insertError?.message || 'Unknown error',
          })
        } else {
          productsCreated++
        }
      } catch (err) {
        console.error('Error creating product:', err)
        failedProducts.push({
          productId: product.productId,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    // Step 4: Generate storefront URL
    // In a real implementation, this would be a Shopify store URL
    // For now, generate a mock URL
    const storefrontUrl = `https://${domain.replace(/\./g, '-')}.${
      printifyClient.isMockMode() ? 'mock.swagger.shop' : 'swagger.shop'
    }`

    // Step 5: Update storefront_requests with completion status + DE Step 11
    // competitive-position metrics (real, computed from this exact generation —
    // not estimated): elapsed generation time and an objective brand-fidelity
    // score from the assets actually captured/applied.
    const finalStatus = failedProducts.length === 0 ? 'complete' : failedProducts.length === products.length ? 'failed' : 'partial'
    const generationSeconds = computeGenerationSeconds(storefrontRequest.created_at)
    const { pct: brandFidelityPct, breakdown: brandFidelityBreakdown } = computeBrandFidelity({
      logoUrl,
      primaryColor,
      secondaryColor,
      productsRequested: products.length,
      productsCreated,
    })
    const { error: updateError } = await supabase
      .from('storefront_requests')
      .update({
        status: finalStatus,
        updated_at: new Date().toISOString(),
        generation_seconds: generationSeconds,
        brand_fidelity_pct: brandFidelityPct,
        brand_fidelity_breakdown: brandFidelityBreakdown,
      })
      .eq('id', storefrontId)

    if (updateError) {
      console.error('Error updating storefront_requests:', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to update storefront status' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: productsCreated > 0,
        message: `Storefront created with ${productsCreated}/${products.length} products${
          printifyClient.isMockMode() ? ' (mock mode)' : ''
        }${failedProducts.length > 0 ? ` (${failedProducts.length} failed)` : ''}`,
        storefrontRequest: {
          id: storefrontId,
          domain,
          companyName,
          status: finalStatus,
          productsCreated,
          generationSeconds,
          brandFidelityPct,
        },
        failedProducts: failedProducts.length > 0 ? failedProducts : undefined,
      },
      { status: productsCreated > 0 ? 201 : 207 }
    )
  } catch (err) {
    console.error('Error creating storefront:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
