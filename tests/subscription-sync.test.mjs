// Regression test for the DE-16 Pro-tier ($1,000/yr) Stripe checkout fix
// (src/lib/subscriptionSync.ts). Before this session, verify-session/route.ts
// retrieved the paid Stripe subscription but never wrote it to Supabase (the
// code comment literally said "In production, create/update subscription
// record" and then just returned data to the browser) — so a customer could
// pay and still see 'free' tier. webhook/route.ts had a second, divergent
// copy of similar logic that also never restored 'pro' tier on reactivation.
//
// syncStripeSubscription() is now the single implementation both routes call.
// It takes the Supabase client as a parameter, so it's testable here with a
// fake client double that records every call — no live Supabase project is
// needed (SUPABASE_SERVICE_ROLE_KEY for this app's actual project is not
// available in this environment either; this in-memory double is the
// strongest proof available without it, and pins the exact DB calls made).
//
// Run with: npm test (node --test)
import test from 'node:test'
import assert from 'node:assert/strict'

const { syncStripeSubscription } = await import('../src/lib/subscriptionSync.ts')

/**
 * Minimal fake Supabase client. `tables` seeds what `.select().eq().limit()`
 * returns per table; every `.upsert()` / `.update()` call is recorded on
 * `calls` so tests can assert exactly what was written.
 */
function makeFakeSupabase(tables = {}) {
  const calls = []
  const client = {
    from(table) {
      return {
        select(...selectArgs) {
          return {
            eq(col, val) {
              return {
                async limit(n) {
                  const rows = tables[table] ?? []
                  calls.push({ op: 'select', table, selectArgs, col, val, limit: n })
                  return { data: rows }
                },
              }
            },
          }
        },
        async upsert(payload, opts) {
          calls.push({ op: 'upsert', table, payload, opts })
          return { error: null }
        },
        update(payload) {
          return {
            async eq(col, val) {
              calls.push({ op: 'update', table, payload, col, val })
              return { error: null }
            },
          }
        },
      }
    },
  }
  return { client, calls }
}

const baseInput = {
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_abc',
  stripePriceId: 'price_pro_yearly',
  status: 'active',
  currentPeriodStart: 1_800_000_000,
  currentPeriodEnd: 1_831_536_000,
  customerEmail: 'maya@acme.com',
}

test('syncStripeSubscription links via an existing subscription row (repeat webhook / renewal) and marks the user pro', async () => {
  const { client, calls } = makeFakeSupabase({
    subscriptions: [{ user_id: 'user-1' }],
  })

  const result = await syncStripeSubscription(client, baseInput)

  assert.deepEqual(result, { ok: true, userId: 'user-1', tier: 'pro' })

  const upsertCall = calls.find((c) => c.op === 'upsert')
  assert.equal(upsertCall.table, 'subscriptions')
  assert.equal(upsertCall.payload.user_id, 'user-1')
  assert.equal(upsertCall.payload.status, 'active')
  // Must conflict on stripe_customer_id, not stripe_subscription_id: both
  // columns are UNIQUE NOT NULL, and a resubscribe (cancel, then subscribe
  // again later) reuses the same customer but gets a brand-new subscription
  // ID — conflicting on subscription_id would try to INSERT a second row for
  // an already-existing customer_id and violate the unique constraint.
  assert.equal(upsertCall.opts.onConflict, 'stripe_customer_id')

  const userUpdateCall = calls.find((c) => c.op === 'update' && c.table === 'users')
  assert.equal(userUpdateCall.payload.subscription_tier, 'pro')
  assert.equal(userUpdateCall.val, 'user-1')
})

test('syncStripeSubscription falls back to matching by email for a brand-new subscription (first checkout)', async () => {
  const { client, calls } = makeFakeSupabase({
    subscriptions: [], // no existing subscription row for this Stripe customer yet
    users: [{ id: 'user-42' }],
  })

  const result = await syncStripeSubscription(client, baseInput)

  assert.deepEqual(result, { ok: true, userId: 'user-42', tier: 'pro' })
  const upsertCall = calls.find((c) => c.op === 'upsert')
  assert.equal(upsertCall.payload.user_id, 'user-42')
})

test('syncStripeSubscription returns user_not_found when neither a subscription row nor a matching email exists (no fake success)', async () => {
  const { client, calls } = makeFakeSupabase({ subscriptions: [], users: [] })

  const result = await syncStripeSubscription(client, baseInput)

  assert.deepEqual(result, { ok: false, reason: 'user_not_found' })
  assert.equal(calls.some((c) => c.op === 'upsert'), false, 'must not write a subscription row with no owner')
})

test('syncStripeSubscription downgrades to free tier when Stripe reports a non-active status (e.g. canceled)', async () => {
  const { client, calls } = makeFakeSupabase({ subscriptions: [{ user_id: 'user-7' }] })

  const result = await syncStripeSubscription(client, { ...baseInput, status: 'canceled' })

  assert.deepEqual(result, { ok: true, userId: 'user-7', tier: 'free' })
  const userUpdateCall = calls.find((c) => c.op === 'update' && c.table === 'users')
  assert.equal(userUpdateCall.payload.subscription_tier, 'free')
})

test('syncStripeSubscription clamps an unrecognized Stripe status to "incomplete" instead of violating the DB CHECK constraint', async () => {
  const { client, calls } = makeFakeSupabase({ subscriptions: [{ user_id: 'user-9' }] })

  // 'trialing' is a real Stripe status but is NOT in the subscriptions.status
  // CHECK constraint (migration 0017) — writing it verbatim would 500.
  const result = await syncStripeSubscription(client, { ...baseInput, status: 'trialing' })

  assert.equal(result.ok, true)
  assert.equal(result.tier, 'free') // not active -> not pro
  const upsertCall = calls.find((c) => c.op === 'upsert')
  assert.equal(upsertCall.payload.status, 'incomplete')
})

test('syncStripeSubscription upserts by stripe_customer_id so a resubscribe (same customer, new subscription id) updates the existing row instead of colliding on the UNIQUE stripe_customer_id column', async () => {
  const { client, calls } = makeFakeSupabase({
    // Customer previously had sub_abc (now canceled) and is resubscribing —
    // Stripe issues a brand-new subscription id for the same customer.
    subscriptions: [{ user_id: 'user-1' }],
  })

  const result = await syncStripeSubscription(client, { ...baseInput, stripeSubscriptionId: 'sub_new_resub' })

  assert.deepEqual(result, { ok: true, userId: 'user-1', tier: 'pro' })
  const upsertCall = calls.find((c) => c.op === 'upsert')
  assert.equal(upsertCall.opts.onConflict, 'stripe_customer_id')
  assert.equal(upsertCall.payload.stripe_subscription_id, 'sub_new_resub')
})

test('syncStripeSubscription rejects a subscription with no price line item instead of writing a broken row', async () => {
  const { client, calls } = makeFakeSupabase({ subscriptions: [{ user_id: 'user-1' }] })

  const result = await syncStripeSubscription(client, { ...baseInput, stripePriceId: null })

  assert.deepEqual(result, { ok: false, reason: 'missing_price' })
  assert.equal(calls.length, 0, 'must not touch the DB when the price is missing')
})
