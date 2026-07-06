import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getSupabase } from '@/lib/supabase'

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
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Fetch orders for user's storefronts with date filtering
    const { data: storefronts, error: storefrontError } = await supabase
      .from('storefront_requests')
      .select('id')
      .eq('owner_id', userId)

    if (storefrontError || !storefronts) {
      return NextResponse.json({ error: 'Failed to fetch storefronts' }, { status: 500 })
    }

    const storefrontIds = storefronts.map(sf => sf.id)

    if (storefrontIds.length === 0) {
      return NextResponse.json({
        totalGmvCents: 0,
        totalRevenueCents: 0,
        totalOrdersCents: 0,
        totalOrderCount: 0,
        avgOrderValueCents: 0,
        marginPercentage: 0,
        vendorPayoutCents: 0,
        metrics: {
          gmv: '$0.00',
          revenue: '$0.00',
          margin: '0%',
          orders: 0,
          avgOrderValue: '$0.00'
        }
      })
    }

    let ordersQuery = supabase
      .from('orders')
      .select('total_amount_cents, swagger_fee_cents, vendor_payout_cents, status, created_at')
      .in('storefront_id', storefrontIds)
      .eq('status', 'completed')

    if (dateFrom) {
      ordersQuery = ordersQuery.gte('created_at', dateFrom)
    }
    if (dateTo) {
      ordersQuery = ordersQuery.lte('created_at', dateTo)
    }

    const { data: orders, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error('Orders fetch error:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Aggregate metrics
    const totalGmvCents = (orders || []).reduce((sum: number, o: any) => sum + o.total_amount_cents, 0)
    const totalRevenueCents = (orders || []).reduce((sum: number, o: any) => sum + o.swagger_fee_cents, 0)
    const totalVendorPayoutCents = (orders || []).reduce((sum: number, o: any) => sum + o.vendor_payout_cents, 0)
    const orderCount = (orders || []).length
    const avgOrderValueCents = orderCount > 0 ? Math.round(totalGmvCents / orderCount) : 0
    const marginPercentage = totalGmvCents > 0 ? Math.round((totalRevenueCents / totalGmvCents) * 100 * 10) / 10 : 0

    return NextResponse.json({
      totalGmvCents,
      totalRevenueCents,
      totalVendorPayoutCents,
      totalOrderCount: orderCount,
      avgOrderValueCents,
      marginPercentage,
      metrics: {
        gmv: `$${(totalGmvCents / 100).toFixed(2)}`,
        revenue: `$${(totalRevenueCents / 100).toFixed(2)}`,
        vendorPayout: `$${(totalVendorPayoutCents / 100).toFixed(2)}`,
        margin: `${marginPercentage}%`,
        orders: orderCount,
        avgOrderValue: `$${(avgOrderValueCents / 100).toFixed(2)}`
      }
    })
  } catch (err) {
    console.error('Metrics API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
