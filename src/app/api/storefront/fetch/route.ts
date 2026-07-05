import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeDomain } from '@/lib/brand'
import { normalizeStoredProduct } from '@/lib/printify-catalog'
import { fulfillStorefrontRequest } from '@/lib/storefront-fulfillment'

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

      // Self-heal here too: a row created before this fix (or one whose
      // inline fulfillment attempt during POST /api/storefront/request
      // failed) can still be sitting at 'queued'/stale-'processing'. The
      // store-created confirmation page polls this exact endpoint, so
      // completing it here means the page converges to the real result
      // instead of showing "queued" forever.
      if (storefrontRequest && (storefrontRequest.status === 'queued' || storefrontRequest.status === 'processing')) {
        try {
          await fulfillStorefrontRequest(storefrontRequest.id)
          const retryResult = await supabase
            .from('storefront_requests')
            .select('*')
            .eq('id', idParam)
            .single()
          if (retryResult.data) {
            storefrontRequest = retryResult.data
            storefrontError = null
          }
        } catch (fulfillError) {
          console.error('Self-heal fulfillment error (id lookup):', fulfillError)
        }
      }
    } else if (domainParam) {
      // Fetch by domain (only complete status — for published storefront access)
      const domain = normalizeDomain(domainParam)
      if (!domain) {
        return NextResponse.json(
          { success: false, error: 'Invalid domain format' },
          { status: 400 }
        )
      }
      const completeResult = await supabase
        .from('storefront_requests')
        .select('*')
        .eq('domain', domain)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      storefrontRequest = completeResult.data
      storefrontError = completeResult.error

      if (!storefrontRequest) {
        // No completed storefront yet — check whether one was ever requested
        // for this domain at all. The fast /onboard "Continue to Store" path
        // only ever inserts status='queued' and nothing else historically
        // advanced it (see storefront-fulfillment.ts), so a real, recently
        // submitted domain like mercedes.com would otherwise 404 forever
        // instead of showing a friendly in-progress state.
        const latestResult = await supabase
          .from('storefront_requests')
          .select('*')
          .eq('domain', domain)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        const latest = latestResult.data

        if (latest && (latest.status === 'queued' || latest.status === 'processing')) {
          // Self-heal: attempt to complete it right now rather than making the
          // visitor wait for a background job that doesn't exist.
          try {
            await fulfillStorefrontRequest(latest.id)
          } catch (fulfillError) {
            console.error('Self-heal fulfillment error:', fulfillError)
          }

          const retryResult = await supabase
            .from('storefront_requests')
            .select('*')
            .eq('id', latest.id)
            .single()

          if (retryResult.data?.status === 'complete') {
            storefrontRequest = retryResult.data
            storefrontError = null
          } else {
            // Still not done (e.g. fulfillment failed) — tell the frontend
            // this is a real, in-progress store, not a 404.
            return NextResponse.json(
              {
                success: false,
                inProgress: true,
                status: retryResult.data?.status ?? latest.status,
                error: 'Your storefront is still being generated. Refresh in a moment.',
              },
              { status: 202 }
            )
          }
        } else if (latest && latest.status === 'failed') {
          return NextResponse.json(
            {
              success: false,
              status: 'failed',
              error: 'Storefront generation failed. Please try creating your store again.',
            },
            { status: 409 }
          )
        } else if (latest && latest.status === 'complete') {
          // Rare race: it finished between the completeResult query above and
          // this one (e.g. another request's self-heal just landed).
          storefrontRequest = latest
          storefrontError = null
        }
        // else: no request ever made for this domain — fall through to the
        // standard 404 below.
      }
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

    // Transform stored rows to real, display-safe storefront data. Rows from
    // before the create-product pipeline was fixed can hold raw hex brand
    // colors or dead via.placeholder.com URLs in title/image fields (e.g. the
    // google.com storefront) — normalizeStoredProduct swaps anything
    // unusable for the matching real Printify catalog product at read time,
    // so old storefronts render correctly without a backfill migration.
    const products = (printifyProducts || []).map((p, i) => normalizeStoredProduct(p, i))

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
