#!/usr/bin/env node

/**
 * API smoke tests — zero-dependency Node script
 * Exercises core endpoints with realistic requests and verifies responses.
 * Exits non-zero if any check fails.
 *
 * Usage: DEPLOY_URL=https://example.com node tests/api-smoke.mjs
 *        (must be a real domain; default: http://localhost:3000)
 *
 * Output: One line per test: PASS <name> or FAIL <name> — <detail>
 */

const DEPLOY_URL = process.env.DEPLOY_URL || 'http://localhost:3000'
let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
    passed++
  } catch (err) {
    console.log(`FAIL ${name} — ${err.message}`)
    failed++
  }
}

async function fetch_json(method, path, body = null) {
  const opts = {
    method,
    headers: { 'content-type': 'application/json' },
  }
  if (body) {opts.body = JSON.stringify(body)}
  const res = await fetch(`${DEPLOY_URL}${path}`, opts)
  const data = await res.json()
  return { status: res.status, data }
}

// ============================================================================
// CORE ENDPOINT TESTS
// ============================================================================

await test('GET /api/brand?domain=linear.app returns brand data', async () => {
  const { status, data } = await fetch_json('GET', '/api/brand?domain=linear.app')
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (!data.domain) throw new Error('missing domain field')
  if (!data.companyName) throw new Error('missing companyName field')
  if (!data.primaryColor) throw new Error('missing primaryColor field')
  if (!data.source) throw new Error('missing source field (brandfetch|favicon|fallback)')
})

await test('GET /api/brand?domain=retool.com returns brand data', async () => {
  const { status, data } = await fetch_json('GET', '/api/brand?domain=retool.com')
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (!data.domain) throw new Error('missing domain field')
  if (!data.companyName) throw new Error('missing companyName field')
  if (!data.primaryColor) throw new Error('missing primaryColor field')
})

await test('GET /api/brand with invalid domain returns 400', async () => {
  const { status, data } = await fetch_json('GET', '/api/brand?domain=not-a-domain')
  if (status !== 400) throw new Error(`expected 400, got ${status}`)
  if (!data.error) throw new Error('missing error message')
})

await test('GET /api/brand without domain param returns 400', async () => {
  const { status, data } = await fetch_json('GET', '/api/brand')
  if (status !== 400) throw new Error(`expected 400, got ${status}`)
})

await test('POST /api/domain/submit with valid domain creates submission', async () => {
  const testDomain = `test-${Date.now()}.com`
  const { status, data } = await fetch_json('POST', '/api/domain/submit', {
    domain: testDomain,
    contact_name: 'Test User',
    contact_email: 'test@example.com',
    utm_source: 'google',
    utm_medium: 'organic',
  })
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (!data.id) throw new Error('missing id field in response')
  if (data.domain !== testDomain) throw new Error(`domain mismatch: expected ${testDomain}, got ${data.domain}`)
  if (!data.company_name) throw new Error('missing company_name field')
  if (!data.primary_color) throw new Error('missing primary_color field')
  if (data.status !== 'detected') throw new Error(`expected status=detected, got ${data.status}`)
})

await test('POST /api/domain/submit with real domain linear.app creates submission', async () => {
  const { status, data } = await fetch_json('POST', '/api/domain/submit', {
    domain: 'linear.app',
    contact_name: 'Jane Doe',
    contact_email: 'jane@test.com',
  })
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (!data.id) throw new Error('missing id in response')
  if (data.domain !== 'linear.app') throw new Error(`domain mismatch`)
  if (!data.company_name) throw new Error('missing company_name')
  if (!data.primary_color) throw new Error('missing primary_color')
})

await test('POST /api/domain/submit with personal domain returns 400', async () => {
  const { status, data } = await fetch_json('POST', '/api/domain/submit', {
    domain: 'gmail.com',
    contact_name: 'Test',
    contact_email: 'test@gmail.com',
  })
  if (status !== 400) throw new Error(`expected 400, got ${status}`)
  if (!data.error) throw new Error('missing error message')
})

await test('POST /api/domain/submit with invalid JSON returns 400', async () => {
  const opts = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not-json',
  }
  const res = await fetch(`${DEPLOY_URL}/api/domain/submit`, opts)
  const data = await res.json()
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
})

await test('POST /api/domain/submit without domain field returns 400', async () => {
  const { status, data } = await fetch_json('POST', '/api/domain/submit', {
    contact_name: 'Test',
  })
  if (status !== 400) throw new Error(`expected 400, got ${status}`)
})

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
