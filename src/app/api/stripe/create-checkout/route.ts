import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Initialize Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function createStripeCheckoutSession(customerId: string, priceId: string, userEmail: string) {
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${STRIPE_SECRET_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'customer': customerId,
      'client_reference_id': customerId,
      'payment_method_types[]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'mode': 'subscription',
      'success_url': `${NEXT_PUBLIC_APP_URL}/pro-success?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${NEXT_PUBLIC_APP_URL}/pricing`,
      'customer_email': userEmail,
      'subscription_data[metadata][tier]': 'pro',
      'subscription_data[metadata][company_email]': userEmail,
    }).toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to create Stripe checkout session')
  }

  return response.json()
}

async function createStripeCustomer(email: string) {
  const response = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${STRIPE_SECRET_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'email': email,
      'metadata[source]': 'swagger_ai_pro_tier',
    }).toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to create Stripe customer')
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    // Check environment variables
    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe configuration missing. Please contact support.' },
        { status: 500 }
      )
    }

    const { tier, userEmail } = await request.json()

    if (!tier || tier !== 'pro') {
      return NextResponse.json(
        { error: 'Invalid tier specified' },
        { status: 400 }
      )
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      )
    }

    // IMPLEMENTATION NOTE: Full auth integration with Supabase Auth is pending
    // When implemented:
    // 1. Extract JWT from Authorization header
    // 2. Verify with Supabase.auth.getUser()
    // 3. Confirm user email matches
    // 4. Create/retrieve Stripe customer with Stripe API
    // 5. Create checkout session with the customer ID
    // 6. Return checkout URL
    //
    // For now, return stub response until Stripe keys are configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('<your-')) {
      return NextResponse.json(
        {
          error: 'Stripe Pro tier checkout is being configured. Free tier is fully available.',
          checkoutUrl: null
        },
        { status: 503 }
      )
    }

    // Placeholder for future implementation
    return NextResponse.json(
      { error: 'Pro tier checkout not yet available' },
      { status: 503 }
    )

  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
