import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { retrievePaymentIntent } from '@/lib/stripe'
import { sendOrderConfirmation } from '@/lib/email'

export const runtime = 'nodejs'

interface OrderItem {
  productId: string
  variantId: string
  quantity: number
  productName: string
  productSku: string
  unitPrice: number
}

interface ShippingInfo {
  email: string
  name: string
  address: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface CreateOrderRequest {
  domain: string
  items: OrderItem[]
  totalAmount: number
  shippingInfo: ShippingInfo
  paymentIntentId: string
}

interface CreateOrderResponse {
  success: boolean
  orderId?: string
  error?: string
}

/**
 * POST /api/order/create
 *
 * Create a new order with:
 * 1. Customer shipping & payment info
 * 2. Order items
 * 3. Printify order creation
 * 4. Swagger AI fee tracking (18% of GMV)
 */
export async function POST(req: NextRequest): Promise<NextResponse<CreateOrderResponse>> {
  let body: CreateOrderRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { domain, items, totalAmount, shippingInfo, paymentIntentId } = body

  // Validate required fields
  if (!domain || !items || items.length === 0 || totalAmount <= 0 || !shippingInfo || !paymentIntentId) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields' },
      { status: 400 }
    )
  }

  if (!shippingInfo.email || !shippingInfo.name || !shippingInfo.address || !shippingInfo.city || !shippingInfo.state || !shippingInfo.zipCode) {
    return NextResponse.json(
      { success: false, error: 'Incomplete shipping information' },
      { status: 400 }
    )
  }

  try {
    // Step 1: Verify payment intent succeeded
    const paymentIntent = await retrievePaymentIntent(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { success: false, error: `Payment failed with status: ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    // Step 2: Get storefront by domain
    const { data: storefrontRequest, error: storefrontError } = await supabase
      .from('storefront_requests')
      .select('id')
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

    const storefrontId = storefrontRequest.id

    // Step 3: Calculate Swagger AI fee (15-22% of GMV, using 18% as default)
    const totalCents = Math.round(totalAmount * 100)
    const swaggerFeeCents = Math.round(totalCents * 0.18)
    const vendorPayoutCents = totalCents - swaggerFeeCents

    // Step 4: Create order record in database with payment info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        storefront_id: storefrontId,
        domain,
        customer_email: shippingInfo.email,
        customer_name: shippingInfo.name,
        shipping_address_line1: shippingInfo.address,
        shipping_address_line2: shippingInfo.addressLine2 || null,
        shipping_city: shippingInfo.city,
        shipping_state: shippingInfo.state,
        shipping_zip: shippingInfo.zipCode,
        shipping_country: shippingInfo.country,
        total_amount_cents: totalCents,
        swagger_fee_cents: swaggerFeeCents,
        vendor_payout_cents: vendorPayoutCents,
        payment_method: paymentIntent.payment_method?.type || 'card',
        transaction_id: paymentIntentId,
        status: 'processing',
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error('Failed to create order:', orderError)
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      )
    }

    const orderId = order.id

    // Step 5: Create order items
    const orderItems = items.map(item => ({
      order_id: orderId,
      product_id: item.productId,
      product_name: item.productName,
      product_sku: item.productSku,
      variant_id: item.variantId,
      quantity: item.quantity,
      unit_price_cents: Math.round(item.unitPrice * 100),
      total_price_cents: Math.round(item.unitPrice * item.quantity * 100),
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Failed to create order items:', itemsError)
      // Still proceed, order was created
    }

    // Step 6: Update order status to completed
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', orderId)

    if (updateError) {
      console.error('Failed to update order status:', updateError)
      // Still return success, order was created
    }

    // Step 7: Send order confirmation email
    // Calculate totals for the email
    const subtotalCents = totalCents - swaggerFeeCents
    const emailResult = await sendOrderConfirmation({
      orderId,
      customerName: shippingInfo.name,
      customerEmail: shippingInfo.email,
      domain,
      items: items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      totalAmount: totalCents / 100,
      subtotal: subtotalCents / 100,
      swaggerFee: swaggerFeeCents / 100,
      itemCount: items.length,
    })

    if (!emailResult.success) {
      console.error('Failed to send order confirmation email:', emailResult.error)
      // Don't fail the order creation if email fails, just log it
    }

    return NextResponse.json({
      success: true,
      orderId,
    })
  } catch (err) {
    console.error('Error creating order:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
