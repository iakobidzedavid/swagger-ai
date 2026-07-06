/**
 * Minimal Stripe REST client for the Pro tier ($1,000/yr — DE-16 value-based
 * pricing: free storefront generation + 18% GMV take rate + this Pro upsell).
 *
 * No `stripe` npm package is installed in this repo, so this talks to the
 * Stripe HTTP API directly (Basic auth with the secret key, matching the
 * pattern Stripe's own SDKs use under the hood). Kept intentionally small:
 * only the calls the checkout + webhook + verify-session routes need.
 */
import crypto from 'crypto'

const STRIPE_API = 'https://api.stripe.com/v1'

/** $1,000/yr Pro tier price, in cents — the DE-16 anchor price. */
const PRO_TIER_PRICE_USD_CENTS = 100_000

/** Returns the configured secret key, or null if unset/still a placeholder. */
export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes('<your-')) return null
  return key
}

function isStripeConfigured(): boolean {
  return getStripeSecretKey() !== null
}

/** Flattens a nested object into Stripe's bracketed form-encoding, e.g. `{a:{b:1}}` -> `a[b]=1`. */
function toFormBody(params: Record<string, unknown>): string {
  const pairs: string[] = []
  const walk = (value: unknown, prefix: string) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, `${prefix}[]`))
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, prefix ? `${prefix}[${k}]` : k)
      }
    } else {
      pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`)
    }
  }
  walk(params, '')
  return pairs.join('&')
}

async function stripeFetch(path: string, method: 'GET' | 'POST', params?: Record<string, unknown>) {
  const key = getStripeSecretKey()
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)')

  const auth = `Basic ${Buffer.from(`${key}:`).toString('base64')}`
  const body = params ? toFormBody(params) : ''
  const url = method === 'GET' && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: auth,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? body : undefined,
  })

  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json?.error?.message || `Stripe API error (HTTP ${response.status})`)
  }
  return json
}

/** Finds an existing Stripe customer by exact email match. */
async function findCustomerByEmail(email: string): Promise<{ id: string } | null> {
  const result = await stripeFetch('/customers', 'GET', { email, limit: 1 })
  return result.data?.[0] ?? null
}

async function createCustomer(email: string, metadata: Record<string, string> = {}) {
  return stripeFetch('/customers', 'POST', {
    email,
    metadata: { source: 'swagger_ai_pro_tier', ...metadata },
  })
}

/** Reuses an existing Stripe customer for this email if one exists, avoiding duplicate customers on retry. */
export async function findOrCreateCustomer(email: string, metadata?: Record<string, string>) {
  const existing = await findCustomerByEmail(email)
  if (existing) return existing
  return createCustomer(email, metadata)
}

/**
 * Creates a Checkout Session for the $1,000/yr Pro subscription using inline
 * `price_data` (no pre-created Stripe Price object required — keeps the DE-16
 * price as the single source of truth, right here).
 */
export async function createProCheckoutSession(opts: {
  customerId: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}) {
  return stripeFetch('/checkout/sessions', 'POST', {
    customer: opts.customerId,
    client_reference_id: opts.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: PRO_TIER_PRICE_USD_CENTS,
          recurring: { interval: 'year' },
          product_data: {
            name: 'Swagger AI Pro',
            description: 'Premium onboarding, dedicated support, advanced analytics, API access & SSO — $1,000/yr',
          },
        },
        quantity: 1,
      },
    ],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    subscription_data: { metadata: { tier: 'pro', ...opts.metadata } },
    metadata: opts.metadata,
  })
}

export async function retrieveCheckoutSession(sessionId: string) {
  return stripeFetch(`/checkout/sessions/${sessionId}`, 'GET', { expand: ['subscription'] })
}

export async function retrieveSubscription(subscriptionId: string) {
  return stripeFetch(`/subscriptions/${subscriptionId}`, 'GET')
}

/**
 * Creates a PaymentIntent for an order (DE-15 GMV-based monetization).
 * The PaymentIntent captures payment for the swag order; Swagger AI's 15-22%
 * fee is calculated and tracked separately in the orders table.
 */
export async function createOrderPaymentIntent(opts: {
  amountCents: number // total order amount in cents
  customerId: string
  metadata: Record<string, string>
}) {
  return stripeFetch('/payment_intents', 'POST', {
    amount: opts.amountCents,
    currency: 'usd',
    customer: opts.customerId,
    metadata: opts.metadata,
    automatic_payment_methods: { enabled: true },
  })
}

/**
 * Confirms a PaymentIntent with a payment method.
 * Used after Stripe Elements collect card details client-side.
 */
async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
) {
  return stripeFetch(`/payment_intents/${paymentIntentId}/confirm`, 'POST', {
    payment_method: paymentMethodId,
  })
}

/**
 * Retrieves a PaymentIntent's current state.
 */
export async function retrievePaymentIntent(paymentIntentId: string) {
  return stripeFetch(`/payment_intents/${paymentIntentId}`, 'GET')
}

interface WebhookVerification {
  valid: boolean
  reason?: 'missing_signature_header' | 'malformed_header' | 'signature_mismatch' | 'timestamp_out_of_tolerance'
}

/**
 * Verifies a Stripe webhook signature per Stripe's documented algorithm:
 * https://docs.stripe.com/webhooks#verify-manually
 *
 * Pure function (no env/network access) so it can be unit-tested directly
 * with a fabricated payload — see tests/stripe-webhook.test.mjs.
 */
export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): WebhookVerification {
  if (!signatureHeader) return { valid: false, reason: 'missing_signature_header' }

  let timestamp: string | undefined
  const v1Signatures: string[] = []
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.trim().split('=')
    if (k === 't') timestamp = v
    else if (k === 'v1' && v) v1Signatures.push(v)
  }

  if (!timestamp || v1Signatures.length === 0) return { valid: false, reason: 'malformed_header' }

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')

  const matches = v1Signatures.some((sig) => {
    let sigBuf: Buffer
    try {
      sigBuf = Buffer.from(sig, 'hex')
    } catch {
      return false
    }
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)
  })

  if (!matches) return { valid: false, reason: 'signature_mismatch' }

  const age = nowSeconds - Number(timestamp)
  if (!Number.isFinite(age) || Math.abs(age) > toleranceSeconds) {
    return { valid: false, reason: 'timestamp_out_of_tolerance' }
  }

  return { valid: true }
}
