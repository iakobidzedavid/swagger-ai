import { createClient } from '@supabase/supabase-js'
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

interface ProductGenerationStatus {
  domain: string
  companyName: string | null
  logoUrl: string | null
  brandStatus: 'pending' | 'fetching' | 'detected' | 'failed'
  brandSource?: string | null
  colorCount?: number
  fontCount?: number
  storefrontStatus: string | null
  productCount: number
  syncedProductCount: number
  pendingProductCount: number
  failedProductCount: number
  domainSubmittedAt: string
  storefrontCreatedAt: string | null
  lastProductUpdate: string | null
}

interface PipelineMetrics {
  totalDomains: number
  domainsDetected: number
  storefrontsRequests: number
  productsGenerated: number
  productsSynced: number
  pendingSync: number
  failedSync: number
}

export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    // Authorization: only admins can access product generation data
    // TODO: Replace with your actual auth check (e.g., session.role === 'admin')
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all domain submissions with their related data
    const { data: domainData, error: domainError } = await supabase
      .from('domain_submissions')
      .select('*')
      .order('created_at', { ascending: false })

    if (domainError) {
      console.error('Error fetching domain submissions:', domainError)
      return NextResponse.json(
        { error: 'Failed to fetch domain submissions' },
        { status: 500 }
      )
    }

    // Fetch storefront requests
    const { data: storefrontData, error: storefrontError } = await supabase
      .from('storefront_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (storefrontError) {
      console.error('Error fetching storefront requests:', storefrontError)
      return NextResponse.json(
        { error: 'Failed to fetch storefront requests' },
        { status: 500 }
      )
    }

    // Fetch all products with their sync status
    const { data: productData, error: productError } = await supabase
      .from('printify_products')
      .select('*, storefront_requests(domain)')
      .order('created_at', { ascending: false })

    if (productError) {
      console.error('Error fetching products:', productError)
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    // Build a map of domain -> storefront info
    interface StorefrontData {
      id: string
      domain: string
      status: string
      created_at: string
      [key: string]: unknown
    }
    const storefrontMap = new Map<string, StorefrontData>()
    storefrontData?.forEach((sf: any) => {
      storefrontMap.set(sf.domain, sf)
    })

    // Build a map of storefront_id -> products
    interface ProductData {
      storefront_request_id: string
      sync_status: string
      updated_at: string
      [key: string]: unknown
    }
    const productsMap = new Map<string, ProductData[]>()
    productData?.forEach((product: any) => {
      const sfId = product.storefront_request_id
      if (!productsMap.has(sfId)) {
        productsMap.set(sfId, [])
      }
      productsMap.get(sfId)!.push(product)
    })

    // Build comprehensive status for each domain
    const statuses: ProductGenerationStatus[] = domainData?.map(domain => {
      const storefront = storefrontMap.get(domain.domain)
      const products = storefront ? productsMap.get(storefront.id) || [] : []

      const syncedProducts = products.filter(p => p.sync_status === 'synced').length
      const pendingProducts = products.filter(p => p.sync_status === 'pending').length
      const failedProducts = products.filter(p => p.sync_status === 'failed').length

      return {
        domain: domain.domain,
        companyName: domain.company_name,
        logoUrl: domain.logo_url,
        brandStatus: domain.status as 'pending' | 'fetching' | 'detected' | 'failed',
        brandSource: domain.brand_source,
        colorCount: domain.color_count,
        fontCount: domain.font_count,
        storefrontStatus: storefront?.status || null,
        productCount: products.length,
        syncedProductCount: syncedProducts,
        pendingProductCount: pendingProducts,
        failedProductCount: failedProducts,
        domainSubmittedAt: domain.created_at,
        storefrontCreatedAt: storefront?.created_at || null,
        lastProductUpdate: products.length > 0
          ? (() => {
              try {
                const timestamps = products.map(p => new Date(p.updated_at).getTime()).filter(t => !isNaN(t))
                return timestamps.length > 0
                  ? new Date(Math.max(...timestamps)).toISOString()
                  : null
              } catch {
                return null
              }
            })()
          : null,
      }
    }) || []

    // Calculate pipeline metrics
    const metrics: PipelineMetrics = {
      totalDomains: domainData?.length || 0,
      domainsDetected: domainData?.filter((d: any) => d.status === 'detected').length || 0,
      storefrontsRequests: storefrontData?.length || 0,
      productsGenerated: productData?.length || 0,
      productsSynced: productData?.filter((p: any) => p.sync_status === 'synced').length || 0,
      pendingSync: productData?.filter((p: any) => p.sync_status === 'pending').length || 0,
      failedSync: productData?.filter((p: any) => p.sync_status === 'failed').length || 0,
    }

    return NextResponse.json({
      statuses,
      metrics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in product-generation API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
