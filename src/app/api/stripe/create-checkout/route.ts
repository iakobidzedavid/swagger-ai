import { NextRequest, NextResponse } from 'next/server'
import { getStripeSecretKey, findOrCreateCustomer, createProCheckoutSession } from '@/lib/stripe'
import { verifyAuth } from '@/lib/auth'

const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    // Fail honestly (no fake checkout URL) until real Stripe keys are configured.
    if (!getStripeSecretKey()) {
      return NextResponse.json(
        { error: 'Stripe Pro tier checkout is being configured. Free tier is fully available.', checkoutUrl: null },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { tier } = body

    if (!tier || tier !== 'pro') {
      return NextResponse.json({ error: 'Invalid tier specified' }, { status: 400 })
    }

    // Prefer the authenticated user's email (can't be spoofed) over the
    // client-supplied one; the pricing page currently prompts for an email
    // when the visitor hasn't signed in, so both paths are supported.
    const auth = await verifyAuth(request)
    const userEmail: string | undefined = auth.success && auth.email ? auth.email : body.userEmail

    if (!userEmail || !EMAIL_RE.test(userEmail)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    // Reuse an existing Stripe customer for this email so retrying checkout
    // (e.g. after a cancelled Checkout Session) doesn't create duplicates.
    const customer = await findOrCreateCustomer(userEmail)

    const session = await createProCheckoutSession({
      customerId: customer.id,
      successUrl: `${NEXT_PUBLIC_APP_URL}/pro-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        company_email: userEmail,
        ...(auth.success && auth.userId ? { user_id: auth.userId } : {}),
      },
    })

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL')
    }

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
