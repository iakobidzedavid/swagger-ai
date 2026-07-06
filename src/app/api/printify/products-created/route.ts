import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

interface ProductsCreatedResponse {
  success: boolean
  message: string
  storefront?: {
    id: string
    domain: string
    companyName: string
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string
    status: string
    createdAt: string
  }
  products: Array<{
    id: string
    printifyId: string
    name: string
    description: string
    category: string
    imageUrl: string
    mockupImageUrl?: string | null
    isRealMockup: boolean
    priceUsd: number
    sku: string
    status: 'active' | 'archived'
    brandColorPrimary: string
    brandColorSecondary: string
    createdAt: string
    lastSyncedAt?: string
  }>
  productCount: number
}

/**
 * GET /api/printify/products-created
 *
 * Fetch all products created for a specific storefront request.
 *
 * Query params:
 * - storefrontRequestId (required): UUID of the storefront request
 *
 * Returns:
 * - Storefront metadata (domain, colors, logo)
 * - All created products with sync status
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const storefrontRequestId = searchParams.get('storefrontRequestId')

  if (!storefrontRequestId) {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing required query parameter: storefrontRequestId',
      },
      { status: 400 }
    )
  }

  try {
    // Fetch storefront request
    const { data: storefrontRequest, error: storefrontError } = await supabase
      .from('storefront_requests')
      .select('*')
      .eq('id', storefrontRequestId)
      .single()

    if (storefrontError || !storefrontRequest) {
      console.error('Error fetching storefront request:', storefrontError)
      return NextResponse.json(
        { success: false, message: 'Storefront request not found' },
        { status: 404 }
      )
    }

    // Fetch all products for this storefront
    const { data: products, error: productsError } = await supabase
      .from('printify_products')
      .select('*')
      .eq('storefront_request_id', storefrontRequestId)
      .order('created_at', { ascending: false })

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: `Retrieved ${products?.length || 0} products for storefront`,
        storefront: {
          id: storefrontRequest.id,
          domain: storefrontRequest.domain,
          companyName: storefrontRequest.company_name,
          logoUrl: storefrontRequest.logo_url,
          primaryColor: storefrontRequest.primary_color,
          secondaryColor: storefrontRequest.secondary_color,
          status: storefrontRequest.status,
          createdAt: storefrontRequest.created_at,
        },
        products: (products || []).map((p) => ({
          id: p.id,
          printifyId: p.printify_id,
          name: p.name,
          description: p.description,
          category: p.category,
          imageUrl: p.image_url,
          mockupImageUrl: p.mockup_image_url,
          isRealMockup: !!p.is_real_mockup,
          priceUsd: p.price_usd,
          sku: p.sku,
          status: p.status,
          brandColorPrimary: p.brand_color_primary,
          brandColorSecondary: p.brand_color_secondary,
          createdAt: p.created_at,
          lastSyncedAt: p.last_synced_at,
        })),
        productCount: products?.length || 0,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Error in products-created endpoint:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
