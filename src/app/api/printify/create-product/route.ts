import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface CreateProductRequest {
  storefrontRequestId: string
  productId: string
  productName: string
  productCategory: string
  productImage: string
  productPrice: number
  productSku: string
  primaryColor: string
  secondaryColor: string
}

interface CreateProductResponse {
  success: boolean
  message: string
  product?: {
    id: string
    printifyId: string
    name: string
    category: string
  }
}

/**
 * POST /api/printify/create-product
 *
 * Create a branded product in Printify and store it in the database.
 * This endpoint would integrate with Printify's API to:
 * 1. Create a new product in the user's Printify shop
 * 2. Apply brand colors via design templates
 * 3. Set up print areas and mockups
 * 4. Store the created product in our database
 *
 * NOTE: This is a stub implementation. In production, this would:
 * - Require a valid Printify OAuth token from the user
 * - Call Printify API to create the actual product
 * - Generate mockup images with brand colors
 * - Return real Printify product IDs
 *
 * Current status: NEEDS_HUMAN_APPROVAL for Printify API credentials
 */
export async function POST(req: NextRequest) {
  let body: CreateProductRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const {
    storefrontRequestId,
    productId,
    productName,
    productCategory,
    productImage,
    productPrice,
    productSku,
    primaryColor,
    secondaryColor,
  } = body

  // Validate required fields
  if (!storefrontRequestId || !productId || !productName) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields: storefrontRequestId, productId, productName' },
      { status: 400 }
    )
  }

  try {
    // In production, this would call the Printify API:
    // const printifyResponse = await fetch('https://api.printify.com/v1/shops/{shop_id}/products', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${PRINTIFY_API_TOKEN}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     title: productName,
    //     description: `Branded with ${primaryColor}`,
    //     images: [{ src: productImage }],
    //     variants: [...],
    //     print_areas: [...],
    //   }),
    // })

    // For now, simulate success and store locally
    const { data, error } = await supabase
      .from('printify_products')
      .insert({
        storefront_request_id: storefrontRequestId,
        printify_id: `printify-${productId}-${Date.now()}`, // Simulated ID
        name: productName,
        description: `Branded product with ${primaryColor}`,
        category: productCategory,
        image_url: productImage,
        price_usd: productPrice,
        sku: productSku,
        brand_color_primary: primaryColor,
        brand_color_secondary: secondaryColor,
        status: 'active',
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Supabase product insert error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to save product' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Product created successfully (mock)',
        product: {
          id: data.id,
          printifyId: data.printify_id,
          name: data.name,
          category: data.category,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error creating product:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
