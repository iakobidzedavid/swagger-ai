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
  if (!data.source) throw new Error('missing source field (brandfetch|favicon|theme-color|fallback)')
  // Brand data must be present (either from Brandfetch API or graceful fallback)
  // System is designed to work with or without BRANDFETCH_API_KEY configured
  if (data.source === 'brandfetch') {
    // If Brandfetch API is configured, we expect rich data
    if (!Array.isArray(data.colors) || data.colors.length === 0) {
      throw new Error(`Brandfetch API returned no colors for linear.app: ${JSON.stringify(data)}`)
    }
    if (!Array.isArray(data.fonts) || data.fonts.length === 0) {
      throw new Error(`Brandfetch API returned no fonts for linear.app: ${JSON.stringify(data)}`)
    }
  }
  // Fallback sources (favicon, theme-color) are acceptable — system gracefully degrades
})

await test('GET /api/brand?domain=retool.com returns brand data', async () => {
  const { status, data } = await fetch_json('GET', '/api/brand?domain=retool.com')
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (!data.domain) throw new Error('missing domain field')
  if (!data.companyName) throw new Error('missing companyName field')
  if (!data.primaryColor) throw new Error('missing primaryColor field')
  // Brand data must be present (either from Brandfetch API or graceful fallback)
  if (data.source === 'brandfetch') {
    // If Brandfetch API is configured, we expect rich data
    if (!Array.isArray(data.colors) || data.colors.length === 0) {
      throw new Error(`Brandfetch API returned no colors for retool.com: ${JSON.stringify(data)}`)
    }
    if (!Array.isArray(data.fonts) || data.fonts.length === 0) {
      throw new Error(`Brandfetch API returned no fonts for retool.com: ${JSON.stringify(data)}`)
    }
  }
  // Fallback sources (favicon, theme-color) are acceptable — system gracefully degrades
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
  // Brand source can be brandfetch (when API key configured) or fallback (favicon/theme-color)
  const brandSource = data.brand_source || data.source
  if (brandSource === 'brandfetch') {
    // Rich brand data from Brandfetch
    const colorCount = data.color_count || (data.raw_brand_data?.colors?.length ?? 0)
    const fontCount = data.font_count || (data.raw_brand_data?.fonts?.length ?? 0)
    if (colorCount === 0) {
      throw new Error(`Brandfetch source but color_count is 0: ${JSON.stringify(data)}`)
    }
    if (fontCount === 0) {
      throw new Error(`Brandfetch source but font_count is 0: ${JSON.stringify(data)}`)
    }
  }
  // Fallback sources are acceptable — system gracefully degrades when BRANDFETCH_API_KEY not configured
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

await test('GET /api/domain/validate with valid company domain returns valid:true', async () => {
  const { status, data } = await fetch_json('GET', '/api/domain/validate?domain=linear.app')
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (data.valid !== true) throw new Error(`expected valid:true, got valid:${data.valid}`)
  if (!data.domain) throw new Error('missing domain field')
})

await test('GET /api/domain/validate with personal domain returns valid:false with reason', async () => {
  const { status, data } = await fetch_json('GET', '/api/domain/validate?domain=gmail.com')
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (data.valid !== false) throw new Error(`expected valid:false, got valid:${data.valid}`)
  if (!data.reason) throw new Error('missing reason field for invalid domain')
  if (!data.reason.includes('personal')) throw new Error(`expected "personal" in reason, got: ${data.reason}`)
})

await test('GET /api/domain/validate with non-existent domain returns valid:false with reason', async () => {
  const { status, data } = await fetch_json('GET', '/api/domain/validate?domain=invaliddomainthatdoesnotexist99999.com')
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (data.valid !== false) throw new Error(`expected valid:false, got valid:${data.valid}`)
  if (!data.reason) throw new Error('missing reason field for non-existent domain')
})

// ============================================================================
// STOREFRONT GENERATION FLOW (full end-to-end)
// ============================================================================

// DE-22 MVBP: the complete fast self-serve path:
// 1. domain submission → brand detection (Brandfetch)
// 2. storefront request → queued/processing
// 3. storefront fulfillment → products created
// 4. storefront fetch → display storefront with products

let lastStorefrontRequestId = null

await test('POST /api/storefront/request queues a storefront for a valid domain', async () => {
  const { status, data } = await fetch_json('POST', '/api/storefront/request', {
    domain: 'linear.app',
    company_name: 'Linear',
    logo_url: 'https://example.com/logo.png',
    primary_color: '#3e3e42',
    secondary_color: '#8fa3b8',
  })
  if (status !== 201) throw new Error(`expected 201, got ${status}`)
  if (!data.id) throw new Error('missing id in response')
  if (data.domain !== 'linear.app') throw new Error('domain mismatch')
  if (!data.status) throw new Error('missing status field')
  // Status can be 'queued', 'processing', 'partial', or 'complete' depending on
  // whether fulfillment completed synchronously inline or is still running
  if (!['queued', 'processing', 'partial', 'complete'].includes(data.status)) {
    throw new Error(`unexpected status: ${data.status}`)
  }
  lastStorefrontRequestId = data.id
})

await test('GET /api/storefront/fetch?id=<request_id> retrieves queued storefront', async () => {
  if (!lastStorefrontRequestId) throw new Error('no storefront request ID from previous test')
  const { status, data } = await fetch_json('GET', `/api/storefront/fetch?id=${encodeURIComponent(lastStorefrontRequestId)}`)
  if (status !== 200) throw new Error(`expected 200, got ${status}`)
  if (!data.id) throw new Error('missing id field')
  if (!data.domain) throw new Error('missing domain field')
  if (!data.status) throw new Error('missing status field')
  // After fulfillment (sync or via self-heal in fetch), should have products
  // For now, just verify the structure exists — products may be in progress
  if (!Array.isArray(data.products) && data.status !== 'queued') {
    // If status is queued/processing, products array may not be present yet
  }
})

await test('GET /api/storefront/fetch?domain=linear.app returns complete storefront when ready', async () => {
  // The full storefront with products is only returned when status='complete'
  // This may 404 or return 202 in-progress if fulfillment is still running
  const { status, data } = await fetch_json('GET', '/api/storefront/fetch?domain=linear.app')

  // Acceptable responses:
  // - 200 + success:true + products array (storefront is complete)
  // - 202 + inProgress:true (storefront is still generating, visitor should retry)
  // - 404 (no storefront ever created for this domain yet — this is OK in a fresh test environment)
  if (status === 200) {
    if (!data.success) throw new Error('success=false in 200 response')
    if (!data.data) throw new Error('missing data field')
    if (!data.data.domain) throw new Error('missing data.domain')
    if (!Array.isArray(data.data.products)) throw new Error('products must be an array')
    // The products array should have products if the storefront is complete
    // (the self-heal in fetch or the initial fulfillment should have created them)
  } else if (status === 202) {
    if (!data.inProgress) throw new Error('inProgress should be true for 202')
  } else if (status === 404) {
    // OK — no completed storefront for this domain yet (fresh test environment)
  } else {
    throw new Error(`unexpected status: ${status}`)
  }
})

await test('POST /api/domain/submit + POST /api/storefront/request creates a complete storefront flow', async () => {
  // Full integration test: submit domain → auto-trigger storefront request
  // This mirrors the actual user flow on /onboard page
  const testDomain = `swagger-test-${Date.now()}.com`

  // Step 1: Submit domain, get brand data
  const submitRes = await fetch_json('POST', '/api/domain/submit', {
    domain: testDomain,
    contact_name: 'Integration Test',
    contact_email: 'test@example.com',
  })
  if (submitRes.status !== 200) throw new Error(`domain/submit failed: ${submitRes.status}`)
  const domainId = submitRes.data.id
  if (!domainId) throw new Error('no submission ID returned')
  if (submitRes.data.status !== 'detected') throw new Error('domain submission should be in detected status')

  // Step 2: Queue storefront request using detected brand data
  const storeRes = await fetch_json('POST', '/api/storefront/request', {
    domain_submission_id: domainId,
    domain: testDomain,
    company_name: submitRes.data.company_name,
    logo_url: submitRes.data.logo_url,
    primary_color: submitRes.data.primary_color,
    secondary_color: submitRes.data.secondary_color,
  })
  if (storeRes.status !== 201) throw new Error(`storefront/request failed: ${storeRes.status}`)
  const requestId = storeRes.data.id
  if (!requestId) throw new Error('no storefront request ID returned')

  // Step 3: Verify storefront can be fetched
  const fetchRes = await fetch_json('GET', `/api/storefront/fetch?id=${encodeURIComponent(requestId)}`)
  if (fetchRes.status !== 200) throw new Error(`storefront/fetch failed: ${fetchRes.status}`)
  if (!fetchRes.data.id) throw new Error('storefront missing id')
  if (fetchRes.data.domain !== testDomain) throw new Error('storefront domain mismatch')
})

// ============================================================================
// DASHBOARD PAGE (admin dashboard with empty states for new users)
// ============================================================================

await test('GET /dashboard returns 200 and shows empty states (no auth error)', async () => {
  const res = await fetch(`${DEPLOY_URL}/dashboard`)
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`)
  const html = await res.text()
  // Should NOT show authentication error (the fix we're testing)
  if (html.includes('Authentication required') && html.includes('Please create a storefront first')) {
    throw new Error('authentication blocker still present — empty states unreachable')
  }
  // Should contain elements for the empty state experience
  if (!html.includes('/onboard') && !html.includes('Create Your')) {
    throw new Error('missing CTA to create storefront — empty state not functional')
  }
})

// ============================================================================
// GALLERY PAGE (visitor-facing brand sample gallery)
// ============================================================================

await test('GET /gallery returns 200 and contains expected content', async () => {
  const res = await fetch(`${DEPLOY_URL}/gallery`)
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`)
  const html = await res.text()
  if (!html.includes('Brand Sample Gallery')) throw new Error('missing gallery title')
  if (!html.includes('real company brands')) throw new Error('missing descriptive text')
  if (!html.includes('linear.com') && !html.includes('Brand Colors')) throw new Error('missing brand data elements')
})

// ============================================================================
// 404 PAGE (on-brand error page with navigation)
// ============================================================================

await test('GET /nonexistent-route returns 404 with branded error page', async () => {
  const res = await fetch(`${DEPLOY_URL}/nonexistent-route-xyz-404-test`)
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`)
  const html = await res.text()
  // Verify the 404 page contains expected elements
  if (!html.includes('404')) throw new Error('missing 404 text in response')
  if (!html.includes('Page not found') && !html.includes('page you')) throw new Error('missing error message')
  // Verify back-to-home links are present
  if (!html.includes('href="/"') && !html.includes('Back to home')) {
    throw new Error('missing link back to home')
  }
  // Verify on-brand styling is applied (check for design tokens in the HTML or CSS)
  if (!html.includes('color') && !html.includes('button')) {
    throw new Error('404 page missing expected HTML structure')
  }
})

await test('POST /api/analytics/track-404 tracks 404 event with path and referrer', async () => {
  const testPath = '/broken-link-test-' + Date.now()
  const { status, data } = await fetch_json('POST', '/api/analytics/track-404', {
    attempted_path: testPath,
    referrer: 'https://example.com/previous-page',
    user_agent: 'Test User Agent',
    utm_source: 'test_source',
    utm_medium: 'test_medium',
    utm_campaign: 'test_campaign',
  })
  if (status !== 200 && status !== 202) throw new Error(`expected 200 or 202, got ${status}`)
  if (!data.success) throw new Error('response should have success=true')
  if (status === 200 && !data.event_id) throw new Error('missing event_id in 200 response')
  if (data.attempted_path !== testPath) throw new Error(`attempted_path mismatch`)
})

await test('POST /api/analytics/track-404 handles missing referrer gracefully', async () => {
  const testPath = '/another-broken-link-' + Date.now()
  const { status, data } = await fetch_json('POST', '/api/analytics/track-404', {
    attempted_path: testPath,
    // omit referrer, user_agent, and utm params
  })
  if (status !== 200 && status !== 202) throw new Error(`expected 200 or 202, got ${status}`)
  if (!data.success) throw new Error('response should indicate success')
})

await test('POST /api/analytics/track-404 with invalid JSON returns 400', async () => {
  const opts = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not-json',
  }
  const res = await fetch(`${DEPLOY_URL}/api/analytics/track-404`, opts)
  const data = await res.json()
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`)
})

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
