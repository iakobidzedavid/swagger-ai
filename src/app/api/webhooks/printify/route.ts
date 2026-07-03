import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendFulfillmentUpdate } from '@/lib/email'
import {
  verifyPrintifyWebhookSignature,
  PrintifyWebhookEventType,
  PrintifyWebhookPayload,
  PrintifyOrderEvent,
  PrintifyFulfillmentEvent,
  PrintifyShipmentEvent,
} from '@/lib/printify-webhook'

const PRINTIFY_ADMIN_SECRET = process.env.PRINTIFY_ADMIN_SECRET

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/printify
 *
 * Handles Printify webhook events for order fulfillment tracking with integrated email notifications.
 *
 * FEATURES:
 * ─────────
 * 1. Order Status Tracking — maintains order status throughout the fulfillment lifecycle
 * 2. Email Notifications — sends transactional emails at key fulfillment milestones
 * 3. Tracking Link Integration — includes carrier tracking URLs in shipment emails
 * 4. Database Persistence — logs all notifications to email_notifications table for audit/retry
 *
 * NOTIFICATION FLOW:
 * ──────────────────
 * Event Type              Email Status      Includes Tracking?    Message
 * ──────────────────────────────────────────────────────────────────────────────────────
 * fulfillment:confirmed   → 'confirmed'     ✗ No                 Order confirmed, preparing production
 * fulfillment:in_progress → 'in_progress'   ✗ No                 Items being printed and prepared
 * shipment:in_transit     → 'shipped'       ✓ YES (tracking URL) Package shipped, on its way
 * shipment:delivered      → 'delivered'     ✓ YES (tracking URL) Order delivered successfully
 *
 * Webhook Events Handled:
 * - order:created — when a new order is placed
 * - order:updated — when order status changes
 * - fulfillment:created — when production starts
 * - fulfillment:updated — when production progresses
 * - shipment:created — when item ships
 * - shipment:updated — when shipping updates
 * - shipment:delivered — when customer receives item
 *
 * TRACKING LINK FEATURE:
 * ─────────────────────
 * Tracking numbers, carriers, and URLs are stored in the orders table:
 * - tracking_number: Carrier-specific tracking code (e.g., "1Z999AA10123456784")
 * - tracking_carrier: Shipping carrier name (e.g., "UPS", "FedEx", "USPS")
 * - tracking_url: Direct URL to carrier's tracking page (e.g., "https://tracking.ups.com/...")
 * - shipped_at: Timestamp when shipment was initiated
 * - delivered_at: Timestamp when delivery was confirmed
 *
 * Email templates include a prominent "Track Your Package" button with the tracking_url,
 * enabling customers to monitor their order status in real-time.
 *
 * Webhook Security:
 * - Verifies X-Printify-Signature header with HMAC-SHA256
 * - Requires PRINTIFY_ADMIN_SECRET environment variable
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Step 1: Verify webhook is configured
    if (!PRINTIFY_ADMIN_SECRET) {
      console.error('[Printify Webhook] PRINTIFY_ADMIN_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    // Step 2: Get the raw body for signature verification
    const body = await req.text()

    // Step 3: Verify signature
    const signature = req.headers.get('x-printify-signature')
    if (!signature) {
      console.warn('[Printify Webhook] Missing X-Printify-Signature header')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    const isValid = verifyPrintifyWebhookSignature(body, signature, PRINTIFY_ADMIN_SECRET)
    if (!isValid) {
      console.warn('[Printify Webhook] Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Step 4: Parse the webhook payload
    let payload: PrintifyWebhookPayload
    try {
      payload = JSON.parse(body)
    } catch (e) {
      console.error('[Printify Webhook] Failed to parse JSON:', e)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Step 5: Route to appropriate handler
    const event = payload.event as PrintifyWebhookEventType
    console.log(`[Printify Webhook] Received event: ${event}`)

    switch (event) {
      case PrintifyWebhookEventType.ORDER_CREATED:
      case PrintifyWebhookEventType.ORDER_UPDATED:
        await handleOrderEvent(payload.data as PrintifyOrderEvent, event)
        break

      case PrintifyWebhookEventType.FULFILLMENT_CREATED:
      case PrintifyWebhookEventType.FULFILLMENT_UPDATED:
        await handleFulfillmentEvent(payload.data as PrintifyFulfillmentEvent, event)
        break

      case PrintifyWebhookEventType.SHIPMENT_CREATED:
      case PrintifyWebhookEventType.SHIPMENT_UPDATED:
      case PrintifyWebhookEventType.SHIPMENT_DELIVERED:
        await handleShipmentEvent(payload.data as PrintifyShipmentEvent, event)
        break

      default:
        console.log(`[Printify Webhook] Unhandled event type: ${event}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[Printify Webhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle order events from Printify
 * Updates order status and stores Printify order ID
 */
async function handleOrderEvent(
  orderData: PrintifyOrderEvent,
  eventType: PrintifyWebhookEventType
): Promise<void> {
  try {
    const printifyOrderId = orderData.id

    // Map Printify status to our internal status
    const statusMap: Record<string, string> = {
      'pending': 'processing',
      'confirmed': 'processing',
      'shipped': 'completed',
      'delivered': 'completed',
      'canceled': 'failed',
      'failed': 'failed',
    }

    const orderStatus = statusMap[orderData.status] || 'processing'

    console.log(
      `[Printify Webhook] ${eventType}: Order ${printifyOrderId} status=${orderData.status}`
    )

    // Try to find order by Printify order ID
    let orderResult = await supabase
      .from('orders')
      .select('id, domain')
      .eq('printify_order_id', printifyOrderId)
      .limit(1)
      .maybeSingle()

    // If not found, we might need to create it from Printify data
    // This can happen if the order was created through Shopify/Printify directly
    // rather than through our /api/order/create endpoint
    if (orderResult.error || !orderResult.data) {
      console.log(
        `[Printify Webhook] Order ${printifyOrderId} not found in database, attempting to create...`
      )

      // Extract domain from address or use a fallback
      const domain = orderData.address_to?.email?.split('@')[1] || 'unknown'

      const insertResult = await supabase
        .from('orders')
        .insert({
          domain,
          customer_email: orderData.address_to?.email || 'unknown@unknown.com',
          customer_name: orderData.address_to?.first_name || 'Unknown',
          shipping_address_line1: orderData.address_to?.address1,
          shipping_address_line2: orderData.address_to?.address2 || null,
          shipping_city: orderData.address_to?.city,
          shipping_state: orderData.address_to?.region,
          shipping_zip: orderData.address_to?.postcode,
          shipping_country: orderData.address_to?.country_code,
          // Calculate totals from line items
          total_amount_cents: calculateOrderTotal(orderData.line_items),
          swagger_fee_cents: calculateSwaggerFee(orderData.line_items),
          vendor_payout_cents: calculateVendorPayout(orderData.line_items),
          status: orderStatus,
          printify_order_id: printifyOrderId,
        })
        .select('id, domain')
        .single()

      if (insertResult.error) {
        console.error(
          `[Printify Webhook] Failed to create order for ${printifyOrderId}:`,
          insertResult.error
        )
        return
      }

      orderResult = insertResult
    }

    // Ensure we have order data
    if (!orderResult.data) {
      console.warn(`[Printify Webhook] No order found or created for ${printifyOrderId}`)
      return
    }

    // Step 2: Update order status
    const updateResult = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        printify_order_id: printifyOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderResult.data.id)

    if (updateResult.error) {
      console.error(
        `[Printify Webhook] Failed to update order ${orderResult.data.id}:`,
        updateResult.error
      )
      return
    }

    console.log(
      `[Printify Webhook] Successfully updated order ${orderResult.data.id} with status=${orderStatus}`
    )
  } catch (error) {
    console.error('[Printify Webhook] Error handling order event:', error)
  }
}

/**
 * Handle fulfillment events from Printify
 * Updates order with fulfillment status and sends email notifications
 */
async function handleFulfillmentEvent(
  fulfillmentData: PrintifyFulfillmentEvent,
  eventType: PrintifyWebhookEventType
): Promise<void> {
  try {
    console.log(
      `[Printify Webhook] ${eventType}: Fulfillment ${fulfillmentData.id} for order ${fulfillmentData.order_id}`
    )

    // Map fulfillment status to order status
    const fulfillmentStatusMap: Record<string, string> = {
      'draft': 'processing',
      'confirmed': 'processing',
      'in_progress': 'processing',
      'shipped': 'completed',
      'delivered': 'completed',
      'canceled': 'failed',
      'failed': 'failed',
    }

    const orderStatus = fulfillmentStatusMap[fulfillmentData.status] || 'processing'

    // Find the order by Printify order ID
    const orderResult = await supabase
      .from('orders')
      .select('id, customer_email, customer_name')
      .eq('printify_order_id', fulfillmentData.order_id)
      .limit(1)
      .maybeSingle()

    if (!orderResult.data) {
      console.warn(
        `[Printify Webhook] Order ${fulfillmentData.order_id} not found for fulfillment update`
      )
      return
    }

    // Update order with fulfillment status
    const updateResult = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderResult.data.id)

    if (updateResult.error) {
      console.error(
        `[Printify Webhook] Failed to update fulfillment status for order ${orderResult.data.id}:`,
        updateResult.error
      )
      return
    }

    console.log(
      `[Printify Webhook] Successfully updated order ${orderResult.data.id} fulfillment status=${orderStatus}`
    )

    // Send fulfillment update email for significant status changes
    // Map fulfillment status to email notification status
    const shouldSendEmail = ['confirmed', 'in_progress', 'shipped', 'delivered'].includes(
      fulfillmentData.status
    )

    if (shouldSendEmail && orderResult.data.customer_email) {
      let statusForEmail: 'confirmed' | 'in_progress' | 'shipped' | 'delivered' = 'in_progress'
      if (fulfillmentData.status === 'confirmed') {
        statusForEmail = 'confirmed'
      } else if (fulfillmentData.status === 'in_progress') {
        statusForEmail = 'in_progress'
      } else if (fulfillmentData.status === 'shipped') {
        statusForEmail = 'shipped'
      } else if (fulfillmentData.status === 'delivered') {
        statusForEmail = 'delivered'
      }

      const emailResult = await sendFulfillmentUpdate({
        orderId: orderResult.data.id,
        customerEmail: orderResult.data.customer_email,
        customerName: orderResult.data.customer_name || 'Customer',
        status: statusForEmail,
        // Note: Tracking info will be added by the shipment event handler
      })

      if (!emailResult.success) {
        console.error(
          `[Printify Webhook] Failed to send fulfillment email for order ${orderResult.data.id}:`,
          emailResult.error
        )
      } else {
        console.log(
          `[Printify Webhook] Sent fulfillment email for order ${orderResult.data.id} (status: ${statusForEmail})`
        )
      }
    }
  } catch (error) {
    console.error('[Printify Webhook] Error handling fulfillment event:', error)
  }
}

/**
 * Handle shipment events from Printify
 * Updates order with shipping/delivery status
 */
async function handleShipmentEvent(
  shipmentData: PrintifyShipmentEvent,
  eventType: PrintifyWebhookEventType
): Promise<void> {
  try {
    console.log(
      `[Printify Webhook] ${eventType}: Shipment ${shipmentData.id} for order ${shipmentData.order_id}`
    )

    // Map shipment status to order status
    const shipmentStatusMap: Record<string, string> = {
      'pending': 'processing',
      'in_transit': 'completed',
      'delivered': 'completed',
      'failed': 'failed',
    }

    const orderStatus = shipmentStatusMap[shipmentData.status] || 'processing'

    // Find the order by Printify order ID
    const orderResult = await supabase
      .from('orders')
      .select('id')
      .eq('printify_order_id', shipmentData.order_id)
      .limit(1)
      .maybeSingle()

    if (!orderResult.data) {
      console.warn(
        `[Printify Webhook] Order ${shipmentData.order_id} not found for shipment update`
      )
      return
    }

    // Update order with shipment status and tracking information
    const updateData: any = {
      status: orderStatus,
      updated_at: new Date().toISOString(),
      tracking_number: shipmentData.number,
      tracking_carrier: shipmentData.carrier,
      tracking_url: shipmentData.url,
    }

    // Add timestamp based on shipment status
    if (shipmentData.status === 'in_transit') {
      updateData.shipped_at = new Date().toISOString()
    } else if (shipmentData.status === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    const updateResult = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderResult.data.id)

    if (updateResult.error) {
      console.error(
        `[Printify Webhook] Failed to update shipment status for order ${orderResult.data.id}:`,
        updateResult.error
      )
      return
    }

    console.log(
      `[Printify Webhook] Successfully updated order ${orderResult.data.id} shipment status=${orderStatus} (${shipmentData.carrier} ${shipmentData.number})`
    )

    // Send shipment update email with tracking information
    // The tracking URL is embedded in the email, allowing customers to track their package in real-time
    const orderDetailsResult = await supabase
      .from('orders')
      .select('customer_email, customer_name')
      .eq('id', orderResult.data.id)
      .single()

    if (orderDetailsResult.data) {
      let statusForEmail: 'confirmed' | 'in_progress' | 'shipped' | 'delivered' = 'shipped'
      if (shipmentData.status === 'delivered') {
        statusForEmail = 'delivered'
      }

      // Send email with tracking link included in the HTML template
      const emailResult = await sendFulfillmentUpdate({
        orderId: orderResult.data.id,
        customerEmail: orderDetailsResult.data.customer_email,
        customerName: orderDetailsResult.data.customer_name || 'Customer',
        status: statusForEmail,
        trackingCarrier: shipmentData.carrier,
        trackingNumber: shipmentData.number,
        trackingUrl: shipmentData.url,
      })

      if (!emailResult.success) {
        console.error(
          `[Printify Webhook] Failed to send shipment email for order ${orderResult.data.id}:`,
          emailResult.error
        )
      } else {
        console.log(
          `[Printify Webhook] Sent shipment email with tracking link for order ${orderResult.data.id} (${shipmentData.carrier} ${shipmentData.number})`
        )
      }
    }
  } catch (error) {
    console.error('[Printify Webhook] Error handling shipment event:', error)
  }
}

/**
 * Calculate total order amount from line items
 */
function calculateOrderTotal(
  lineItems: Array<{ quantity: number; price: number }> | undefined
): number {
  if (!lineItems || lineItems.length === 0) return 0
  const total = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return Math.round(total * 100) // Convert to cents
}

/**
 * Calculate Swagger AI fee (18% of total)
 */
function calculateSwaggerFee(
  lineItems: Array<{ quantity: number; price: number }> | undefined
): number {
  const total = calculateOrderTotal(lineItems)
  return Math.round(total * 0.18)
}

/**
 * Calculate vendor payout (82% of total)
 */
function calculateVendorPayout(
  lineItems: Array<{ quantity: number; price: number }> | undefined
): number {
  const total = calculateOrderTotal(lineItems)
  return total - calculateSwaggerFee(lineItems)
}
