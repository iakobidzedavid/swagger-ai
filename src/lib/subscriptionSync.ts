/**
 * Shared logic for turning a Stripe subscription payload into our DB state
 * (`subscriptions` + `users.subscription_tier`). Used by BOTH the webhook
 * handler (source of truth for lifecycle events) and the verify-session
 * route (immediate UI feedback right after checkout, before the webhook
 * necessarily arrives) — previously these two routes each had their own
 * divergent copy of this logic, and verify-session's copy was a stub that
 * never actually wrote to the DB.
 *
 * Takes the Supabase client as a parameter (instead of importing one) so
 * this stays testable with a fake client double — see
 * tests/subscription-sync.test.mjs.
 */

/** Statuses the `subscriptions` table CHECK constraint accepts (migration 0017). */
const ALLOWED_STATUSES = ['active', 'past_due', 'unpaid', 'canceled', 'incomplete'] as const
type AllowedStatus = (typeof ALLOWED_STATUSES)[number]

interface StripeSubscriptionSyncInput {
  stripeCustomerId: string
  stripeSubscriptionId: string
  stripePriceId: string | undefined | null
  status: string
  currentPeriodStart: number // unix seconds
  currentPeriodEnd: number // unix seconds
  customerEmail?: string | null
  cancelAt?: number | null
  canceledAt?: number | null
}

type SyncResult =
  | { ok: true; userId: string; tier: 'pro' | 'free' }
  | { ok: false; reason: 'user_not_found' | 'missing_price' | 'db_error' }

function toIso(unixSeconds: number | null | undefined): string | null {
  return typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000).toISOString() : null
}

// Deliberately typed `any` rather than `SupabaseClient` from '@supabase/supabase-js':
// that type's deeply generic PostgrestQueryBuilder chain causes `tsc` to fail the
// build with "Type instantiation is excessively deep and possibly infinite" once
// this function is called with the real client. The shape this code actually
// relies on is just `.from(table).select().eq().limit()` /
// `.from(table).upsert()` / `.from(table).update().eq()` — documented here so a
// test double only needs to satisfy that, not the full SupabaseClient type.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

export async function syncStripeSubscription(
  supabase: AnySupabaseClient,
  input: StripeSubscriptionSyncInput
): Promise<SyncResult> {
  if (!input.stripePriceId) {
    console.error(`subscriptionSync: subscription ${input.stripeSubscriptionId} has no price ID`)
    return { ok: false, reason: 'missing_price' }
  }

  // Resolve the local user this Stripe customer belongs to: prefer an
  // existing subscription row (stable across email changes), fall back to
  // matching by the email Stripe/Checkout gave us.
  let userId: string | null = null

  const { data: existingSubs } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', input.stripeCustomerId)
    .limit(1)

  if (existingSubs && existingSubs.length > 0) {
    userId = (existingSubs[0] as { user_id: string }).user_id
  } else if (input.customerEmail) {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('email', input.customerEmail)
      .limit(1)
    if (users && users.length > 0) {
      userId = (users[0] as { id: string }).id
    }
  }

  if (!userId) {
    console.warn(
      `subscriptionSync: no local user found for Stripe customer ${input.stripeCustomerId}` +
        (input.customerEmail ? ` / email ${input.customerEmail}` : '') +
        ' — subscription recorded state is unavailable until the user signs up with a matching email'
    )
    return { ok: false, reason: 'user_not_found' }
  }

  const safeStatus: AllowedStatus = (ALLOWED_STATUSES as readonly string[]).includes(input.status)
    ? (input.status as AllowedStatus)
    : 'incomplete'
  const isActive = safeStatus === 'active'

  // Conflict target must be `stripe_customer_id`, not `stripe_subscription_id`:
  // both columns are UNIQUE NOT NULL (migration 0017), and findOrCreateCustomer
  // deliberately reuses the same Stripe customer across checkout retries AND
  // resubscribes (cancel -> subscribe again later gets a NEW subscription ID
  // on the SAME customer). Conflicting on stripe_subscription_id would try to
  // INSERT a second row for a customer_id that already exists -> unique
  // violation -> db_error -> the paying user never gets marked pro. One row
  // per Stripe customer is also the correct model here (a customer has at
  // most one current subscription in this product).
  const { error: upsertError } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_price_id: input.stripePriceId,
      status: safeStatus,
      current_period_start: toIso(input.currentPeriodStart),
      current_period_end: toIso(input.currentPeriodEnd),
      cancel_at: toIso(input.cancelAt),
      canceled_at: toIso(input.canceledAt),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_customer_id' }
  )

  if (upsertError) {
    console.error('subscriptionSync: failed to upsert subscription row', upsertError)
    return { ok: false, reason: 'db_error' }
  }

  const { error: userUpdateError } = await supabase
    .from('users')
    .update({ subscription_tier: isActive ? 'pro' : 'free', updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (userUpdateError) {
    console.error('subscriptionSync: failed to update user tier', userUpdateError)
    return { ok: false, reason: 'db_error' }
  }

  return { ok: true, userId, tier: isActive ? 'pro' : 'free' }
}
