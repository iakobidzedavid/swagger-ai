import { NextRequest, NextResponse } from 'next/server'
import { sendOrderConfirmation, sendFulfillmentUpdate } from '@/lib/email'

/**
 * POST /api/notifications/send-test
 *
 * Development endpoint for sending test notification emails
 * Useful for demonstrating email functionality without creating real orders
 *
 * Request body:
 * {
 *   "type": "order_confirmation" | "fulfillment_update",
 *   "email": "test@example.com",
 *   "customerName": "John Doe",
 *   "domain": "acme.com",
 *   // For order_confirmation:
 *   "items": [
 *     { "productName": "T-Shirt", "quantity": 2, "unitPrice": 25 }
 *   ],
 *   "totalAmount": 57.50,
 *   // For fulfillment_update:
 *   "status": "shipped",
 *   "trackingCarrier": "FedEx",
 *   "trackingNumber": "1234567890"
 * }
 */

export const runtime = 'nodejs'

interface TestEmailRequest {
  type: 'order_confirmation' | 'fulfillment_update'
  email: string
  customerName: string
  domain?: string
  items?: Array<{ productName: string; quantity: number; unitPrice: number }>
  totalAmount?: number
  status?: 'confirmed' | 'in_progress' | 'shipped' | 'delivered'
  trackingCarrier?: string
  trackingNumber?: string
  orderId?: string | null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Only allow in development or with special header
    const isDev =
      process.env.NODE_ENV === 'development' ||
      process.env.ALLOW_TEST_EMAILS === 'true'

    const authHeader = req.headers.get('x-test-auth')
    if (!isDev && authHeader !== process.env.TEST_EMAIL_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized - test emails disabled' },
        { status: 403 }
      )
    }

    const body = (await req.json()) as TestEmailRequest

    // Validate required fields
    if (!body.type || !body.email || !body.customerName) {
      return NextResponse.json(
        {
          error: 'Missing required fields: type, email, customerName',
        },
        { status: 400 }
      )
    }

    let result

    if (body.type === 'order_confirmation') {
      if (!body.items || body.items.length === 0 || !body.totalAmount || !body.domain) {
        return NextResponse.json(
          {
            error:
              'Missing required fields for order_confirmation: items, totalAmount, domain',
          },
          { status: 400 }
        )
      }

      const totalAmount = body.totalAmount

      result = await sendOrderConfirmation({
        orderId: body.orderId !== undefined ? body.orderId : 'test-' + Date.now(),
        customerName: body.customerName,
        customerEmail: body.email,
        domain: body.domain,
        items: body.items,
        totalAmount,
        itemCount: body.items.reduce((sum, item) => sum + item.quantity, 0),
      })
    } else if (body.type === 'fulfillment_update') {
      if (!body.status) {
        return NextResponse.json(
          { error: 'Missing required field for fulfillment_update: status' },
          { status: 400 }
        )
      }

      result = await sendFulfillmentUpdate({
        orderId: body.orderId !== undefined ? body.orderId : 'test-' + Date.now(),
        customerEmail: body.email,
        customerName: body.customerName,
        status: body.status as 'confirmed' | 'in_progress' | 'shipped' | 'delivered',
        trackingCarrier: body.trackingCarrier,
        trackingNumber: body.trackingNumber,
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid type - must be order_confirmation or fulfillment_update' },
        { status: 400 }
      )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Test ${body.type} email sent to ${body.email}`,
    })
  } catch (err) {
    console.error('[Test Email] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
