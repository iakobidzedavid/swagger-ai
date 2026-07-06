import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authHeader.replace('Bearer ', '')

    // Validate userId is not a placeholder
    if (userId === 'placeholder' || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()
    const { id: orderId } = await params

    // Fetch order and verify ownership via storefront
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `id, storefront_id, domain, customer_email, customer_name,
         total_amount_cents, swagger_fee_cents, vendor_payout_cents,
         status, created_at, updated_at,
         storefront_requests!orders_storefront_id_fkey(id, owner_id, domain, company_name),
         order_items(id, product_id, product_name, quantity, unit_price_cents, total_price_cents)`
      )
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify ownership - handle both array and object responses
    const storefrontData = Array.isArray(order.storefront_requests)
      ? order.storefront_requests[0]
      : order.storefront_requests

    if (storefrontData?.owner_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Format response
    const items = (order.order_items || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      unitPriceDisplay: `$${(item.unit_price_cents / 100).toFixed(2)}`,
      totalPriceCents: item.total_price_cents,
      totalPriceDisplay: `$${(item.total_price_cents / 100).toFixed(2)}`
    }))

    return NextResponse.json({
      order: {
        id: order.id,
        storefrontId: order.storefront_id,
        domain: order.domain,
        companyName: storefrontData?.company_name || order.domain,
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
        createdAtDisplay: new Date(order.created_at).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        updatedAt: order.updated_at,
        items
      }
    })
  } catch (err) {
    console.error('Order detail API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
