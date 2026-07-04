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
 * GET /api/storefront/fetch?id=<request_id> or ?domain=acme.com
 *
 * Fetch a storefront request by ID (any status) or by domain (complete only).
 * For store-created confirmation, use ID query to show the queued request immediately.
 * Returns storefront configuration and brand assets.
 */
export async function GET(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get('id')
  const domainParam = req.nextUrl.searchParams.get('domain')

  let storefrontRequest: any = null
  let storefrontError: any = null

  try {
    if (idParam) {
      // Fetch by request ID (any status — for store-created confirmation page)
      const result = await supabase
        .from('storefront_requests')
        .select('*')
        .eq('id', idParam)
        .single()
      storefrontRequest = result.data
      storefrontError = result.error
    } else if (domainParam) {
      // Fetch by domain (only complete status — for published storefront access)
      const domain = normalizeDomain(domainParam)
      if (!domain) {
        return NextResponse.json(
          { success: false, error: 'Invalid domain format' },
          { status: 400 }
        )
      }
      const result = await supabase
        .from('storefront_requests')
        .select('*')
        .eq('domain', domain)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      storefrontRequest = result.data
      storefrontError = result.error
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing id or domain parameter' },
        { status: 400 }
      )
    }

    if (storefrontError || !storefrontRequest) {
      return NextResponse.json(
        { success: false, error: 'Storefront not found' },
        { status: 404 }
      )
    }

    // Store-created confirmation page always looks up by ID and expects the
    // raw row (snake_case columns, including status/created_at/the DE Step 11
    // competitive-position metrics) — regardless of status. Previously this
    // only returned the raw row for 'queued' and otherwise fell through to the
    // domain-lookup shape below (wrapped, camelCase, missing created_at/status),
    // which broke the confirmation page for every completed storefront.
    if (idParam) {
      const { count: productsCreated } = await supabase
        .from('printify_products')
        .select('id', { count: 'exact', head: true })
        .eq('storefront_request_id', storefrontRequest.id)

      return NextResponse.json(
        { ...storefrontRequest, productsCreated: productsCreated ?? 0 },
        { status: 200 }
      )
    }

    // For published storefronts, fetch products
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
