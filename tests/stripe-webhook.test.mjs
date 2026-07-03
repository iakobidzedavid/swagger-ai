// Regression test for the DE-16 Pro-tier ($1,000/yr) Stripe checkout fix
// (src/lib/stripe.ts). The webhook route previously verified signatures with
// a plain `===` string comparison (a timing side-channel) and had no replay
// protection. verifyStripeWebhookSignature is now a pure function so it can
// be exercised directly with a fabricated payload/secret — no live Stripe
// account or network call required (Stripe test/live keys are not available
// in this environment; this is the strongest proof available without them).
//
// Run with: npm test (node --test)
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'

const { verifyStripeWebhookSignature } = await import('../src/lib/stripe.ts')

const SECRET = 'whsec_test_secret_12345'

function signPayload(payload, timestampSeconds, secret = SECRET) {
  const signature = crypto.createHmac('sha256', secret).update(`${timestampSeconds}.${payload}`, 'utf8').digest('hex')
  return `t=${timestampSeconds},v1=${signature}`
}

test('verifyStripeWebhookSignature accepts a correctly signed, fresh payload', () => {
  const now = 1_800_000_000
  const payload = JSON.stringify({ type: 'customer.subscription.created', id: 'evt_1' })
  const header = signPayload(payload, now)
  const result = verifyStripeWebhookSignature(payload, header, SECRET, 300, now)
  assert.equal(result.valid, true)
})

test('verifyStripeWebhookSignature rejects a tampered payload (body changed after signing)', () => {
  const now = 1_800_000_000
  const original = JSON.stringify({ type: 'customer.subscription.created', amount: 100000 })
  const header = signPayload(original, now)
  const tampered = JSON.stringify({ type: 'customer.subscription.created', amount: 999999999 })
  const result = verifyStripeWebhookSignature(tampered, header, SECRET, 300, now)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'signature_mismatch')
})

test('verifyStripeWebhookSignature rejects a signature made with the wrong secret', () => {
  const now = 1_800_000_000
  const payload = JSON.stringify({ type: 'ping' })
  const header = signPayload(payload, now, 'whsec_totally_different')
  const result = verifyStripeWebhookSignature(payload, header, SECRET, 300, now)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'signature_mismatch')
})

test('verifyStripeWebhookSignature rejects a stale timestamp outside the replay-protection window', () => {
  const signedAt = 1_800_000_000
  const receivedAt = signedAt + 400 // 400s later, tolerance is 300s
  const payload = JSON.stringify({ type: 'customer.subscription.updated' })
  const header = signPayload(payload, signedAt)
  const result = verifyStripeWebhookSignature(payload, header, SECRET, 300, receivedAt)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'timestamp_out_of_tolerance')
})

test('verifyStripeWebhookSignature rejects a missing signature header', () => {
  const result = verifyStripeWebhookSignature('{}', '', SECRET)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'missing_signature_header')
})

test('verifyStripeWebhookSignature rejects a malformed header (no v1=)', () => {
  const result = verifyStripeWebhookSignature('{}', 't=123456789', SECRET)
  assert.equal(result.valid, false)
  assert.equal(result.reason, 'malformed_header')
})

test('verifyStripeWebhookSignature accepts when multiple v1 signatures are present and one matches (Stripe secret-rotation format)', () => {
  const now = 1_800_000_000
  const payload = JSON.stringify({ type: 'customer.subscription.deleted' })
  const validSig = crypto.createHmac('sha256', SECRET).update(`${now}.${payload}`, 'utf8').digest('hex')
  const bogusSig = 'f'.repeat(64)
  const header = `t=${now},v1=${bogusSig},v1=${validSig}`
  const result = verifyStripeWebhookSignature(payload, header, SECRET, 300, now)
  assert.equal(result.valid, true)
})
