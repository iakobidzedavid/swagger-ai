// Regression test for the brand_cache read-through cache added to
// GET /api/brand (src/app/api/brand/route.ts). Found/added while adding a
// Supabase-backed cache layer so repeat homepage brand-preview lookups skip
// redundant external favicon/theme-color fetches (Gstack session, 2026-07-02).
//
// Covers the two pure/testable pieces of that change: the domain-format guard
// that now runs before a row can ever be written to brand_cache (previously
// this route had no format validation at all, unlike its siblings
// /api/domain/validate and /api/domain/submit — an adversarial review caught
// that an unbounded/malformed domain string would let a caller grow the
// cache table indefinitely with junk keys that never hit and never expire),
// and the TTL freshness check that decides cache-hit vs cache-miss.
//
// Run with: npm test (node --test)
import test from 'node:test'
import assert from 'node:assert/strict'

// tsx lets node:test load a .ts module directly without a build step.
const { DOMAIN_RE, normalizeDomain, isCacheFresh } = await import('../src/lib/brand.ts')

test('DOMAIN_RE accepts real-shaped domains', () => {
  assert.equal(DOMAIN_RE.test('acme.com'), true)
  assert.equal(DOMAIN_RE.test('linear.app'), true)
  assert.equal(DOMAIN_RE.test('sub.acme.co.uk'), true)
})

test('DOMAIN_RE rejects malformed/garbage input (the cache-poisoning vector an adversarial review found)', () => {
  assert.equal(DOMAIN_RE.test(''), false)
  assert.equal(DOMAIN_RE.test('not a domain'), false)
  assert.equal(DOMAIN_RE.test('http://acme.com'), false) // must be pre-normalized
  assert.equal(DOMAIN_RE.test('a'.repeat(500)), false) // no TLD, single label
  assert.equal(DOMAIN_RE.test('acme'), false) // no TLD
})

test('normalizeDomain strips scheme, path, and lowercases', () => {
  assert.equal(normalizeDomain('https://Acme.com/pricing'), 'acme.com')
  assert.equal(normalizeDomain('  Linear.App  '), 'linear.app')
  assert.equal(normalizeDomain('http://sub.acme.com'), 'sub.acme.com')
})

test('isCacheFresh returns true for a row fetched moments ago', () => {
  const now = Date.parse('2026-07-02T12:00:00.000Z')
  const fetchedAt = new Date(now - 1000).toISOString() // 1s old
  assert.equal(isCacheFresh(fetchedAt, now), true)
})

test('isCacheFresh returns true right at the 24h TTL boundary', () => {
  const now = Date.parse('2026-07-02T12:00:00.000Z')
  const fetchedAt = new Date(now - 24 * 60 * 60 * 1000).toISOString() // exactly 24h old
  assert.equal(isCacheFresh(fetchedAt, now), true)
})

test('isCacheFresh returns false just past the 24h TTL boundary (forces a live re-fetch)', () => {
  const now = Date.parse('2026-07-02T12:00:00.000Z')
  const fetchedAt = new Date(now - 24 * 60 * 60 * 1000 - 1).toISOString() // 24h + 1ms old
  assert.equal(isCacheFresh(fetchedAt, now), false)
})

test('isCacheFresh returns false for a long-stale row (e.g. a week-old cache entry)', () => {
  const now = Date.parse('2026-07-02T12:00:00.000Z')
  const fetchedAt = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  assert.equal(isCacheFresh(fetchedAt, now), false)
})
