import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { createOrderPaymentIntent, findOrCreateCustomer } from '@/lib/stripe'

export const runtime = 'nodejs'

interface CreatePaymentIntentRequest {
  email: string
  amountCents: number
  domain: string
  orderId?: string
}

interface CreatePaymentIntentResponse {
  success: boolean
  clientSecret?: string
  paymentIntentId?: string
  error?: string
}

/**
 * POST /api/payment/create-intent
 *
 * Creates a Stripe PaymentIntent for an order.
 * Called before the user enters payment details in the checkout form.
 *
 * Returns clientSecret which is passed to Stripe Elements to confirm payment.
 */
export async function POST(req: NextRequest): Promise<NextResponse<CreatePaymentIntentResponse>> {
  let body: CreatePaymentIntentRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { email, amountCents, domain } = body

  // Validate required fields
  if (!email || !amountCents || amountCents <= 0 || !domain) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid required fields' },
      { status: 400 }
    )
  }

  try {
    // Step 1: Find or create Stripe customer by email
    const customer = await findOrCreateCustomer(email, {
      domain,
      source: 'swagger_ai_order',
    })

    // Step 2: Create PaymentIntent with order metadata
    const paymentIntent = await createOrderPaymentIntent({
      amountCents,
      customerId: customer.id,
      metadata: {
        email,
        domain,
        source: 'swagger_ai_order',
      },
    })

    // Step 3: Return client secret to frontend
    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (err) {
    console.error('Error creating payment intent:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
