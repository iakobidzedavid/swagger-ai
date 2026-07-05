// Regression tests for src/lib/email.ts (Pica Gmail passthrough integration).
//
// Found/added during /qa on the branch that replaced the fake "always
// succeeds" dev-mode email sender with a real Gmail send via Pica's HTTP
// passthrough API, and added `provider_message_id` tracking.
//
// A CRITICAL bug was found and fixed in the same session: `to`, `subject`,
// and `displayName` (the latter sourced directly from customer checkout
// input, e.g. shippingInfo.name) were interpolated into raw RFC 2822 email
// headers with no CRLF stripping — a customer name containing "\r\n" could
// inject arbitrary headers (e.g. an extra Bcc:) into every outbound email.
//
// No live Supabase project or Pica account is available in this environment,
// so both are exercised through a single global.fetch mock (supabase-js and
// the Pica passthrough call both ultimately go through fetch) — this proves
// the real code path end-to-end without any live credentials.
//
// Run with: npm test (node --test)
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'

// supabase-js eagerly constructs a Realtime client (unused by email.ts, which
// only does .insert()/.update() over REST) and that constructor requires a
// WebSocket global on Node < 22. Stub just enough to satisfy the constructor
// check — no realtime channel is ever opened in these tests.
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = class WebSocketStub {}
}

function decodeRaw(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function installFetchMock(picaHandler) {
  const originalFetch = global.fetch
  const calls = { pica: [] }
  global.fetch = async (url, init) => {
    const href = String(url)
    if (href.includes('/rest/v1/email_notifications')) {
      // Minimal Supabase PostgREST stand-in: INSERT (.select().single()) and
      // UPDATE both just need to look like a successful response.
      const isInsert = (init?.method || 'GET').toUpperCase() === 'POST'
      const body = isInsert ? JSON.stringify([{ id: 'notif-1' }]) : JSON.stringify([])
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (href.includes('api.picaos.com/v1/passthrough')) {
      calls.pica.push({ url: href, init })
      return picaHandler(init)
    }
    throw new Error(`Unexpected fetch to ${href}`)
  }
  return { calls, restore: () => { global.fetch = originalFetch } }
}

test('sendOrderConfirmation fails gracefully (not a fake success) when Pica creds are missing', async () => {
  delete process.env.PICA_SECRET
  delete process.env.PICA_GMAIL_CONNECTION_KEY
  const mock = installFetchMock(() => { throw new Error('Pica should not be called without creds') })
  try {
    const { sendOrderConfirmation } = await import('../src/lib/email.ts?t=1')
    const result = await sendOrderConfirmation({
      orderId: 'order-1',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      domain: 'example.com',
      items: [{ productName: 'Widget', quantity: 1, unitPrice: 9.99 }],
      totalAmount: 9.99,
      itemCount: 1,
    })
    assert.equal(result.success, false)
    assert.match(result.error, /PICA_SECRET/)
  } finally {
    mock.restore()
  }
})

test('sendOrderConfirmation sends a real Gmail message via Pica and records provider_message_id', async () => {
  process.env.PICA_SECRET = 'test-secret'
  process.env.PICA_GMAIL_CONNECTION_KEY = 'test-connection-key'
  const mock = installFetchMock(() =>
    new Response(JSON.stringify({ id: 'gmail-msg-123' }), { status: 200 })
  )
  try {
    const { sendOrderConfirmation } = await import('../src/lib/email.ts?t=2')
    const result = await sendOrderConfirmation({
      orderId: 'order-2',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      domain: 'example.com',
      items: [{ productName: 'Widget', quantity: 1, unitPrice: 9.99 }],
      totalAmount: 9.99,
      itemCount: 1,
    })
    assert.equal(result.success, true)
    assert.equal(mock.calls.pica.length, 1)
    const sentBody = JSON.parse(mock.calls.pica[0].init.body)
    const decoded = decodeRaw(sentBody.raw)
    assert.match(decoded, /To: "Jane Doe" <jane@example\.com>/)
  } finally {
    mock.restore()
  }
})

test('sendOrderConfirmation strips CRLF header injection from customer-controlled name (regression)', async () => {
  process.env.PICA_SECRET = 'test-secret'
  process.env.PICA_GMAIL_CONNECTION_KEY = 'test-connection-key'
  const mock = installFetchMock(() =>
    new Response(JSON.stringify({ id: 'gmail-msg-456' }), { status: 200 })
  )
  try {
    const { sendOrderConfirmation } = await import('../src/lib/email.ts?t=3')
    const maliciousName = 'Foo\r\nBcc: attacker@evil.com\r\nX-Injected: yes'
    const result = await sendOrderConfirmation({
      orderId: 'order-3',
      customerName: maliciousName,
      customerEmail: 'jane@example.com',
      domain: 'example.com',
      items: [{ productName: 'Widget', quantity: 1, unitPrice: 9.99 }],
      totalAmount: 9.99,
      itemCount: 1,
    })
    assert.equal(result.success, true)
    const sentBody = JSON.parse(mock.calls.pica[0].init.body)
    const decoded = decodeRaw(sentBody.raw)
    const headerSection = decoded.split('\r\n\r\n')[0]
    // The injected "Bcc:" and "X-Injected:" must NOT appear as their own
    // header lines — only the legitimate To/Subject/MIME-Version/Content-Type.
    assert.equal(/^Bcc:/m.test(headerSection), false, 'Bcc header must not be injectable')
    assert.equal(/^X-Injected:/m.test(headerSection), false, 'arbitrary header must not be injectable')
    assert.equal(headerSection.split('\r\n').filter(Boolean).length, 4, 'exactly 4 header lines: To, Subject, MIME-Version, Content-Type')
  } finally {
    mock.restore()
  }
})
