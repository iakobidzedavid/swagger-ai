import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

interface OrderItemData {
  productName: string
  productSku: string
  quantity: number
  totalPrice: number
}

interface OrderData {
  id: string
  customerEmail: string
  customerName: string
  totalAmount: number
  swaggerFee: number
  status: string
  createdAt: string
  items: OrderItemData[]
}

interface GetOrderResponse {
  success: boolean
  order?: OrderData
  error?: string
}

/**
 * GET /api/order/[id]
 *
 * Retrieves a complete order record with items.
 * Used by order confirmation page to display order details.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse<GetOrderResponse>> {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Order ID is required' },
      { status: 400 }
    )
  }

  try {
    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id)

    if (itemsError) {
      console.error('Failed to fetch order items:', itemsError)
      // Continue even if items fail to load
    }

    // Transform to response format
    const orderData: OrderData = {
      id: order.id,
      customerEmail: order.customer_email,
      customerName: order.customer_name || 'Customer',
      totalAmount: order.total_amount_cents / 100,
      swaggerFee: order.swagger_fee_cents / 100,
      status: order.status,
      createdAt: new Date(order.created_at).toLocaleDateString(),
      items: (items || []).map(item => ({
        productName: item.product_name,
        productSku: item.product_sku,
        quantity: item.quantity,
        totalPrice: item.total_price_cents / 100,
      })),
    }

    return NextResponse.json({
      success: true,
      order: orderData,
    })
  } catch (err) {
    console.error('Error fetching order:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
