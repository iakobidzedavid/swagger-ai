import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyStripeWebhookSignature } from '@/lib/stripe'
import { syncStripeSubscription } from '@/lib/subscriptionSync'

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionEvent(subscription: any) {
  const price = subscription.items?.data?.[0]?.price
  const result = await syncStripeSubscription(supabase, {
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripePriceId: price?.id,
    status: subscription.status,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    customerEmail: subscription.metadata?.company_email || subscription.customer_email || null,
    cancelAt: subscription.cancel_at ?? null,
    canceledAt: subscription.canceled_at ?? null,
  })
  if (!result.ok) {
    console.warn(`Webhook: could not sync subscription ${subscription.id} (${result.reason})`)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionDeleted(subscription: any) {
  try {
    const stripeCustomerId = subscription.customer

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .limit(1)

    if (subs && subs.length > 0) {
      await supabase
        .from('users')
        .update({ subscription_tier: 'free', updated_at: new Date().toISOString() })
        .eq('id', subs[0].user_id)
    }

    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', stripeCustomerId)
  } catch (error) {
    console.error('Error handling subscription.deleted event:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    const signature = request.headers.get('stripe-signature') || ''
    const body = await request.text()

    const verification = verifyStripeWebhookSignature(body, signature, STRIPE_WEBHOOK_SECRET)
    if (!verification.valid) {
      console.error(`Webhook signature check failed: ${verification.reason}`)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let event
    try {
      event = JSON.parse(body)
    } catch (parseError) {
      console.error('Failed to parse webhook body:', parseError)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break

      default:
        console.log(`Unhandled webhook event: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 })
  }
}
