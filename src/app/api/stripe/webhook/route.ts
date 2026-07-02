import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

// Initialize Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function verifyStripeSignature(body: string, signature: string): Promise<boolean> {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return false
  }

  // Simple HMAC-SHA256 verification for Stripe webhook signature
  // Stripe format: t=timestamp,v1=signature
  const crypto = require('crypto')
  const parts = signature.split(',')
  const timestamp = parts[0]?.split('=')[1]
  const sentSignature = parts[1]?.split('=')[1]

  if (!timestamp || !sentSignature) {
    console.error('Invalid webhook signature format')
    return false
  }

  // Reconstruct signed content: timestamp.body
  const signedContent = `${timestamp}.${body}`
  const expectedSignature = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(signedContent)
    .digest('hex')

  return sentSignature === expectedSignature
}

async function handleSubscriptionCreated(subscription: any) {
  try {
    const stripeCustomerId = subscription.customer
    const stripeSubscriptionId = subscription.id
    const stripePriceId = subscription.items?.data?.[0]?.price?.id
    const status = subscription.status
    const customerEmail = subscription.customer_email || subscription.metadata?.company_email

    if (!stripePriceId) {
      console.error('No price ID found in subscription')
      return
    }

    // Check if subscription already exists
    const { data: existingSubs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .limit(1)

    if (existingSubs && existingSubs.length > 0) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: stripePriceId,
          status,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          updated_at: new Date(),
        })
        .eq('stripe_customer_id', stripeCustomerId)

      if (updateError) {
        console.error('Error updating subscription:', updateError)
        return
      }

      // Update user tier if subscription is active
      if (status === 'active') {
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ subscription_tier: 'pro', updated_at: new Date() })
          .eq('id', existingSubs[0].user_id)

        if (userUpdateError) {
          console.error('Error updating user tier:', userUpdateError)
        }
      }
    } else {
      // For new subscriptions, find user by email if available
      // If not found, log for manual review
      if (customerEmail) {
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('email', customerEmail)
          .limit(1)

        if (users && users.length > 0) {
          // Create subscription record
          const { error: createError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: users[0].id,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              stripe_price_id: stripePriceId,
              status,
              current_period_start: new Date(subscription.current_period_start * 1000),
              current_period_end: new Date(subscription.current_period_end * 1000),
            })

          if (createError) {
            console.error('Error creating subscription record:', createError)
            return
          }

          // Update user tier
          if (status === 'active') {
            await supabase
              .from('users')
              .update({ subscription_tier: 'pro', updated_at: new Date() })
              .eq('id', users[0].id)
          }
        } else {
          console.warn(`No user found for email ${customerEmail} - subscription may need manual linkage`)
        }
      } else {
        console.warn(`No email found in subscription ${stripeSubscriptionId} - cannot link to user`)
      }
    }
  } catch (error) {
    console.error('Error handling subscription.created event:', error)
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  try {
    const stripeCustomerId = subscription.customer
    const status = subscription.status

    // Update subscription status
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status,
        current_period_end: new Date(subscription.current_period_end * 1000),
        updated_at: new Date(),
      })
      .eq('stripe_customer_id', stripeCustomerId)

    if (updateError) {
      console.error('Error updating subscription:', updateError)
      return
    }

    // Downgrade to free if subscription is not active
    if (status !== 'active') {
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .limit(1)

      if (subs && subs.length > 0) {
        await supabase
          .from('users')
          .update({ subscription_tier: 'free', updated_at: new Date() })
          .eq('id', subs[0].user_id)
      }
    }
  } catch (error) {
    console.error('Error handling subscription.updated event:', error)
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  try {
    const stripeCustomerId = subscription.customer

    // Get user ID
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .limit(1)

    if (subs && subs.length > 0) {
      // Downgrade to free
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ subscription_tier: 'free', updated_at: new Date() })
        .eq('id', subs[0].user_id)

      if (userUpdateError) {
        console.error('Error updating user tier on cancellation:', userUpdateError)
      }
    }

    // Mark subscription as canceled
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date(),
        updated_at: new Date(),
      })
      .eq('stripe_customer_id', stripeCustomerId)

    if (updateError) {
      console.error('Error marking subscription as canceled:', updateError)
    }
  } catch (error) {
    console.error('Error handling subscription.deleted event:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    const signature = request.headers.get('stripe-signature') || ''
    const body = await request.text()

    // Verify Stripe signature
    const isValid = await verifyStripeSignature(body, signature)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse JSON body with error handling
    let event
    try {
      event = JSON.parse(body)
    } catch (parseError) {
      console.error('Failed to parse webhook body:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break

      default:
        // Log unhandled events for debugging
        console.log(`Unhandled webhook event: ${event.type}`)
    }

    // Acknowledge receipt of webhook
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    )
  }
}
