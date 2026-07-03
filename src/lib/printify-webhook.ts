/**
 * Printify Webhook Signature Verification
 *
 * Printify sends webhooks with an HMAC signature in the X-Printify-Signature header.
 * The signature is created using the shared secret (PRINTIFY_ADMIN_SECRET) and the request body.
 *
 * Reference: https://developers.printify.com/webhooks
 */

import crypto from 'crypto'

/**
 * Verify a Printify webhook signature
 *
 * @param body The raw request body as a string
 * @param signature The X-Printify-Signature header value
 * @param secret The PRINTIFY_ADMIN_SECRET
 * @returns true if the signature is valid, false otherwise
 */
export function verifyPrintifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.error('[Printify Webhook] Missing signature or secret')
    return false
  }

  // Printify uses HMAC-SHA256 with the request body
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  // First check length to avoid timing-safe equal exception
  if (signature.length !== expectedSignature.length) {
    return false
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Printify webhook event types we handle
 */
export enum PrintifyWebhookEventType {
  // Order lifecycle events
  ORDER_CREATED = 'order:created',
  ORDER_UPDATED = 'order:updated',
  ORDER_CANCELED = 'order:canceled',
  ORDER_FAILED = 'order:failed',

  // Fulfillment events
  FULFILLMENT_CREATED = 'fulfillment:created',
  FULFILLMENT_UPDATED = 'fulfillment:updated',
  FULFILLMENT_FAILED = 'fulfillment:failed',

  // Shipping events
  SHIPMENT_CREATED = 'shipment:created',
  SHIPMENT_UPDATED = 'shipment:updated',
  SHIPMENT_DELIVERED = 'shipment:delivered',
}

/**
 * Printify webhook payload structure
 *
 * Reference: https://developers.printify.com/webhooks#webhook-payload
 */
export interface PrintifyWebhookPayload {
  event: PrintifyWebhookEventType
  timestamp: number
  data: {
    id: string
    type?: string
    [key: string]: unknown
  }
}

/**
 * Order event data from Printify
 *
 * Reference: https://developers.printify.com/webhooks#order-events
 */
export interface PrintifyOrderEvent {
  id: string
  shop_id: string
  status: 'draft' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'canceled' | 'failed'
  shipments?: Array<{
    id: string
    status: string
    carrier?: string
    number?: string
    url?: string
  }>
  line_items?: Array<{
    id: string
    external_line_item_id?: string
    title: string
    quantity: number
    price: number
  }>
  address_to?: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    address1: string
    address2?: string
    city: string
    region: string
    postcode: string
    country_code: string
  }
  address_from?: {
    address1: string
    address2?: string
    city: string
    region: string
    postcode: string
    country_code: string
  }
  [key: string]: unknown
}

/**
 * Fulfillment event data from Printify
 */
export interface PrintifyFulfillmentEvent {
  id: string
  order_id: string
  shop_id: string
  status: 'draft' | 'confirmed' | 'in_progress' | 'shipped' | 'delivered' | 'canceled' | 'failed'
  created_at: string
  updated_at: string
  line_items?: Array<{
    id: string
    external_line_item_id?: string
    product_id: string
    title: string
    quantity: number
  }>
  [key: string]: unknown
}

/**
 * Shipment event data from Printify
 */
export interface PrintifyShipmentEvent {
  id: string
  order_id: string
  status: 'pending' | 'in_transit' | 'delivered' | 'failed'
  created_at: string
  updated_at: string
  carrier?: string
  number?: string
  url?: string
  [key: string]: unknown
}
