import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getSupabase } from '@/lib/supabase'

interface OrderData {
  id: string
  storefront_id: string
  domain: string
  customer_email: string
  customer_name: string | null
  total_amount_cents: number
  swagger_fee_cents: number
  vendor_payout_cents: number
  status: string
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authHeader.replace('Bearer ', '')

    // Validate userId is not empty or placeholder
    if (!userId || userId === 'placeholder') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const storefrontId = searchParams.get('storefrontId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortDir = searchParams.get('sortDir') || 'desc'

    // Fetch user's storefronts to verify ownership
    const { data: storefronts, error: storefrontError } = await supabase
      .from('storefront_requests')
      .select('id')
      .eq('owner_id', userId)

    if (storefrontError || !storefronts) {
      return NextResponse.json({ error: 'Failed to verify access' }, { status: 500 })
    }

    const storefrontIds = storefronts.map(sf => sf.id)

    if (storefrontIds.length === 0) {
      return NextResponse.json({
        orders: [],
        totalCount: 0
      })
    }

    // Build query
    let ordersQuery = supabase
      .from('orders')
      .select(
        `id, storefront_id, domain, customer_email, customer_name,
         total_amount_cents, swagger_fee_cents, vendor_payout_cents,
         status, created_at, updated_at,
         storefront_requests!orders_storefront_id_fkey(domain, company_name)`,
        { count: 'exact' }
      )
      .in('storefront_id', storefrontIds)

    // Filter by storefront if specified
    if (storefrontId && storefrontIds.includes(storefrontId)) {
      ordersQuery = ordersQuery.eq('storefront_id', storefrontId)
    }

    // Filter by date range
    if (dateFrom) {
      ordersQuery = ordersQuery.gte('created_at', dateFrom)
    }
    if (dateTo) {
      ordersQuery = ordersQuery.lte('created_at', dateTo)
    }

    // Only show completed orders
    ordersQuery = ordersQuery.eq('status', 'completed')

    // Apply sorting and pagination
    const validSortColumns = ['created_at', 'total_amount_cents', 'swagger_fee_cents', 'customer_email']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    const ascending = sortDir === 'asc'

    ordersQuery = ordersQuery
      .order(sortColumn, { ascending })
      .range(offset, offset + limit - 1)

    const { data: orders, error: ordersError, count: totalCount } = await ordersQuery

    if (ordersError) {
      console.error('Orders fetch error:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Format orders for response
    const formattedOrders = (orders || []).map((order: any) => ({
      id: order.id,
      storefrontId: order.storefront_id,
      domain: order.domain,
      companyName: order.storefront_requests?.company_name || order.domain,
      customerEmail: order.customer_email,
      customerName: order.customer_name || 'Anonymous',
      gmvCents: order.total_amount_cents,
      gmvDisplay: `$${(order.total_amount_cents / 100).toFixed(2)}`,
      swaggerFeeCents: order.swagger_fee_cents,
      swaggerFeeDisplay: `$${(order.swagger_fee_cents / 100).toFixed(2)}`,
      vendorPayoutCents: order.vendor_payout_cents,
      vendorPayoutDisplay: `$${(order.vendor_payout_cents / 100).toFixed(2)}`,
      marginPercentage: order.total_amount_cents > 0 ? Math.round((order.swagger_fee_cents / order.total_amount_cents) * 100 * 10) / 10 : 0,
      status: order.status,
      createdAt: order.created_at,
      createdAtDisplay: new Date(order.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      updatedAt: order.updated_at
    }))

    return NextResponse.json({
      orders: formattedOrders,
      totalCount: totalCount || 0,
      pageInfo: {
        limit,
        offset,
        hasMore: (offset + limit) < (totalCount || 0)
      }
    })
  } catch (err) {
    console.error('Orders API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
