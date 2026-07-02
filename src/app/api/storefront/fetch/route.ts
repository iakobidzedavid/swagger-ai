import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeDomain } from '@/lib/brand'

export const runtime = 'nodejs'

interface StorefrontData {
  id: string
  domain: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  products: Array<{
    id: string
    title: string
    description: string
    sku: string
    image: string
    mockupImage?: string
    category: string
    variants: Array<{
      id: string
      title: string
      price: number
    }>
  }>
}

/**
 * GET /api/storefront/fetch?domain=acme.com
 *
 * Fetch a published storefront by domain.
 * Returns storefront configuration, brand assets, and product catalog.
 */
export async function GET(req: NextRequest) {
  const domainParam = req.nextUrl.searchParams.get('domain')

  if (!domainParam) {
    return NextResponse.json(
      { success: false, error: 'Missing domain parameter' },
      { status: 400 }
    )
  }

  const domain = normalizeDomain(domainParam)
  if (!domain) {
    return NextResponse.json(
      { success: false, error: 'Invalid domain format' },
      { status: 400 }
    )
  }

  try {
    // Fetch storefront request by domain (most recent published)
    const { data: storefrontRequest, error: storefrontError } = await supabase
      .from('storefront_requests')
      .select('*')
      .eq('domain', domain)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (storefrontError || !storefrontRequest) {
      return NextResponse.json(
        { success: false, error: 'Storefront not found' },
        { status: 404 }
      )
    }

    // Fetch products for this storefront from Printify cache
    const { data: printifyProducts, error: productsError } = await supabase
      .from('printify_products')
      .select('*')
      .eq('storefront_request_id', storefrontRequest.id)

    if (productsError) {
      console.error('Failed to fetch products:', productsError)
      return NextResponse.json(
        { success: false, error: 'Failed to load products' },
        { status: 500 }
      )
    }

    // Transform products to storefront format
    const products = (printifyProducts || []).map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      sku: p.sku,
      image: p.image_url,
      mockupImage: p.mockup_image_url,
      category: p.category,
      variants: p.variants || [],
    }))

    const response: StorefrontData = {
      id: storefrontRequest.id,
      domain: storefrontRequest.domain,
      companyName: storefrontRequest.company_name,
      logoUrl: storefrontRequest.logo_url,
      primaryColor: storefrontRequest.primary_color,
      secondaryColor: storefrontRequest.secondary_color,
      products,
    }

    return NextResponse.json({ success: true, data: response })
  } catch (err) {
    console.error('Error fetching storefront:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
