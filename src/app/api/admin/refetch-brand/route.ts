import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DOMAIN_RE, normalizeDomain } from '@/lib/brand'
import { fetchBrandData } from '@/lib/brandfetch'

export const runtime = 'nodejs'

/**
 * POST /api/admin/refetch-brand
 *
 * Force-refetch brand data from Brandfetch for a specific domain.
 * Updates both brand_cache and any storefront_requests records that reference this domain.
 *
 * Use this endpoint to fix cache poisoning — when a domain was previously cached
 * with a favicon (fallback source) and Brandfetch is now available, this refetch
 * replaces the poisoned logo_url with the real Brandfetch logo.
 *
 * Request body:
 * {
 *   "domain": "bmw.com"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "domain": "bmw.com",
 *   "brand": { ... refetched BrandData },
 *   "storefrontsUpdated": 3,
 *   "cacheUpdated": true
 * }
 */

interface RefetchRequest {
  domain?: string
}

interface RefetchResponse {
  success: boolean
  domain?: string
  brand?: any
  storefrontsUpdated?: number
  cacheUpdated?: boolean
  error?: string
}

export async function POST(req: NextRequest): Promise<NextResponse<RefetchResponse>> {
  try {
    const body = await req.json().catch(() => ({})) as RefetchRequest

    if (!body.domain) {
      return NextResponse.json(
        { success: false, error: 'domain field required' },
        { status: 400 }
      )
    }

    const domain = normalizeDomain(body.domain)
    if (!domain || domain.length > 253 || !DOMAIN_RE.test(domain)) {
      return NextResponse.json(
        { success: false, error: 'Invalid domain format' },
        { status: 400 }
      )
    }

    console.log(`[refetch-brand] Refetching brand data for ${domain}`)

    // Fetch fresh brand data from Brandfetch (with fallback to keyless)
    const brand = await fetchBrandData(domain)

    // Update brand_cache with fresh data
    let cacheUpdated = false
    try {
      const { error: cacheError } = await supabase
        .from('brand_cache')
        .upsert(
          {
            domain: brand.domain,
            company_name: brand.companyName,
            logo_url: brand.logoUrl,
            primary_color: brand.primaryColor,
            secondary_color: brand.secondaryColor,
            source: brand.source,
            raw_brand_data: brand.raw,
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            hit_count: 1, // Reset hit count on refetch
          },
          { onConflict: 'domain' }
        )

      if (!cacheError) {
        cacheUpdated = true
        console.log(`[refetch-brand] Updated brand_cache for ${domain}`)
      } else {
        console.warn(`[refetch-brand] Failed to update brand_cache for ${domain}:`, cacheError)
      }
    } catch (err) {
      console.warn(`[refetch-brand] brand_cache upsert threw:`, err)
    }

    // Update all storefront_requests records for this domain with fresh brand data
    let storefrontsUpdated = 0
    try {
      const { data: storefronts, error: selectError } = await supabase
        .from('storefront_requests')
        .select('id')
        .eq('domain', domain)

      if (!selectError && storefronts && storefronts.length > 0) {
        const { error: updateError } = await supabase
          .from('storefront_requests')
          .update({
            company_name: brand.companyName,
            logo_url: brand.logoUrl,
            primary_color: brand.primaryColor,
            secondary_color: brand.secondaryColor,
            updated_at: new Date().toISOString(),
          })
          .eq('domain', domain)

        if (!updateError) {
          storefrontsUpdated = storefronts.length
          console.log(`[refetch-brand] Updated ${storefrontsUpdated} storefront(s) for ${domain}`)
        } else {
          console.warn(`[refetch-brand] Failed to update storefronts for ${domain}:`, updateError)
        }
      }
    } catch (err) {
      console.warn(`[refetch-brand] storefront update threw:`, err)
    }

    return NextResponse.json({
      success: true,
      domain,
      brand,
      storefrontsUpdated,
      cacheUpdated,
    })
  } catch (err) {
    console.error('[refetch-brand] Unhandled error:', err)
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    )
  }
}
