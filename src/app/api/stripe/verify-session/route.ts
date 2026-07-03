import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getStripeSecretKey, retrieveCheckoutSession, retrieveSubscription } from '@/lib/stripe'
import { syncStripeSubscription } from '@/lib/subscriptionSync'

export async function POST(request: NextRequest) {
  try {
    if (!getStripeSecretKey()) {
      return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
    }

    const { sessionId } = await request.json().catch(() => ({}))
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const session = await retrieveCheckoutSession(sessionId)
    const subscriptionId: string | undefined =
      typeof session?.subscription === 'string' ? session.subscription : session?.subscription?.id

    if (!session || !subscriptionId) {
      return NextResponse.json({ error: 'No subscription found in session' }, { status: 400 })
    }

    const subscription = await retrieveSubscription(subscriptionId)
    const price = subscription?.items?.data?.[0]?.price

    if (!subscription || !price) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 })
    }

    const customerId: string | undefined =
      typeof session.customer === 'string' ? session.customer : session.customer?.id
    const customerEmail: string | null =
      session.customer_details?.email || session.customer_email || subscription.metadata?.company_email || null

    // Persist immediately so the UI reflects Pro status without waiting on
    // the async webhook — the webhook remains the source of truth for later
    // lifecycle events (renewals, cancellations, payment failures).
    const sync = customerId
      ? await syncStripeSubscription(supabase, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: price.id,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          customerEmail,
        })
      : ({ ok: false, reason: 'user_not_found' } as const)

    if (!sync.ok) {
      console.warn(`verify-session: could not link subscription ${subscription.id} to a user (${sync.reason})`)
    }

    return NextResponse.json({
      customer_id: customerId,
      subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      amount: price.unit_amount,
      currency: price.currency,
      linked: sync.ok,
    })
  } catch (error) {
    console.error('Session verification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify session' },
      { status: 500 }
    )
  }
}
