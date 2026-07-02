import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPrintifyClient } from '@/lib/printify'

export const runtime = 'nodejs'

interface ProductSelection {
  productId: string
  productName: string
  productCategory: string
  productImage: string
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
  }
}

/**
 * POST /api/storefront/create
 *
 * Orchestrate the complete storefront creation flow:
 * 1. Create a storefront_requests record
 * 2. Create a Printify shop (or get existing)
 * 3. Create all selected products in Printify
 * 4. Generate a storefront URL
 *
 * This is the primary entry point for the products-selection flow.
 *
 * Requires:
 * - PRINTIFY_API_KEY for real Printify integration
 */
export async function POST(req: NextRequest) {
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

    // Step 1: Create a storefront_requests record
    const { data: storefrontRequest, error: storefrontError } = await supabase
      .from('storefront_requests')
      .insert({
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

    // Step 3: Create products in Printify
    let productsCreated = 0
    const productCreationPromises = products.map((product) =>
      fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/api/printify/create-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storefrontRequestId: storefrontId,
          shopId,
          productId: product.productId,
          productName: product.productName,
          productCategory: product.productCategory,
          productImage: product.productImage,
          productPrice: product.productPrice,
          productSku: product.productSku,
          primaryColor,
          secondaryColor,
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            productsCreated++
          }
          return result
        })
        .catch((err) => {
          console.error('Error creating product:', err)
          return { success: false, error: err.message }
        })
    )

    const productResults = await Promise.all(productCreationPromises)
    const failedProducts = productResults.filter((r) => !r.success)

    // Step 4: Generate storefront URL
    // In a real implementation, this would be a Shopify store URL
    // For now, generate a mock URL
    const storefrontUrl = `https://${domain.replace('.', '-')}.${
      printifyClient.isMockMode() ? 'mock.swagger.shop' : 'swagger.shop'
    }`

    // Update storefront_requests with completion status
    const { error: updateError } = await supabase
      .from('storefront_requests')
      .update({
        status: failedProducts.length === 0 ? 'complete' : 'partial',
        updated_at: new Date().toISOString(),
      })
      .eq('id', storefrontId)

    if (updateError) {
      console.error('Error updating storefront_requests:', updateError)
    }

    return NextResponse.json(
      {
        success: true,
        message: `Storefront created with ${productsCreated}/${products.length} products${
          printifyClient.isMockMode() ? ' (mock mode)' : ''
        }`,
        storefrontRequest: {
          id: storefrontId,
          domain,
          companyName,
          status: failedProducts.length === 0 ? 'complete' : 'partial',
          productsCreated,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error creating storefront:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
