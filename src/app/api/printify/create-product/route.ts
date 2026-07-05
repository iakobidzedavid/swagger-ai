import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPrintifyClient } from '@/lib/printify'

export const runtime = 'nodejs'

interface CreateProductRequest {
  storefrontRequestId: string
  shopId: string
  productId: string
  productName: string
  productCategory: string
  productImage: string
  productDescription?: string
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
 *
 * This endpoint:
 * 1. Calls Printify API to create a new product in the user's shop
 * 2. Applies brand colors via product variants and description
 * 3. Stores the created product metadata in our database
 * 4. Returns the Printify product ID and our local record ID
 *
 * Falls back to mock mode when PRINTIFY_API_KEY is not configured.
 *
 * Requires:
 * - PRINTIFY_API_KEY environment variable (for real API calls)
 * - Valid shopId from /api/printify/shop endpoint
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
    shopId,
    productId,
    productName,
    productCategory,
    productImage,
    productDescription,
    productPrice,
    productSku,
    primaryColor,
    secondaryColor,
  } = body

  // Validate required fields
  if (!storefrontRequestId || !shopId || !productId || !productName) {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing required fields: storefrontRequestId, shopId, productId, productName',
      },
      { status: 400 }
    )
  }

  try {
    const printifyClient = getPrintifyClient()

    // Prepare product data for Printify
    // Use the product's own real catalog description when available — never
    // surface raw hex codes (e.g. "#7c3aed") as customer-facing copy.
    const productData = {
      title: productName,
      description: productDescription?.trim() || `${productName} — custom branded merchandise for your team`,
      images: [{ src: productImage }],
      variants: [
        {
          id: 1,
          title: 'Default',
          price: Math.round(productPrice * 100), // Printify uses cents
          sku: productSku,
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
      // If Printify API fails and we're not in mock mode, return error
      if (!printifyClient.isMockMode()) {
        console.error('Printify API error:', printifyError)
        return NextResponse.json(
          {
            success: false,
            message: `Printify API error: ${printifyError instanceof Error ? printifyError.message : 'Unknown error'}`,
          },
          { status: 500 }
        )
      }
      // In mock mode, use the mock response
      printifyResponse = {
        id: `mock-product-${productId}-${Date.now()}`,
        title: productName,
        description: productData.description,
        images: productData.images,
        variants: productData.variants,
        status: 'draft',
      }
    }

    // Store the created product in our database
    const { data, error } = await supabase
      .from('printify_products')
      .insert({
        storefront_request_id: storefrontRequestId,
        printify_id: printifyResponse.id,
        name: productName,
        description: productData.description,
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
        { success: false, message: 'Failed to save product to database' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: `Product created successfully${printifyClient.isMockMode() ? ' (mock mode)' : ''}`,
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
