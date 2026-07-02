import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

// Initialize Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function getStripeCheckoutSession(sessionId: string) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to retrieve Stripe session')
  }

  return response.json()
}

async function getStripeSubscription(subscriptionId: string) {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to retrieve Stripe subscription')
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe configuration missing' },
        { status: 500 }
      )
    }

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      )
    }

    // Get checkout session details
    const session = await getStripeCheckoutSession(sessionId)

    if (!session || !session.subscription) {
      return NextResponse.json(
        { error: 'No subscription found in session' },
        { status: 400 }
      )
    }

    // Get subscription details
    const subscription = await getStripeSubscription(session.subscription)

    if (!subscription || !subscription.items?.data?.[0]?.price) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      )
    }

    // In production, create/update subscription record in database
    // For now, just return the subscription info
    return NextResponse.json({
      customer_id: session.customer,
      subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      amount: subscription.items.data[0].price.unit_amount,
      currency: subscription.items.data[0].price.currency,
    })
  } catch (error) {
    console.error('Session verification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify session' },
      { status: 500 }
    )
  }
}
