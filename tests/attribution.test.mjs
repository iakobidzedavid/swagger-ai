// Regression test for the DE-18 revenue-engine attribution classifier
// (src/lib/attribution.ts). Found/added while wiring UTM/referrer capture
// into the brand-input page (Gstack session, 2026-07-01).
//
// Run with: npm test (node --test)
import test from 'node:test'
import assert from 'node:assert/strict'

// tsx lets node:test load a .ts module directly without a build step.
const { classifyAttribution, sanitizeAttribution } = await import('../src/lib/attribution.ts')

test('classifyAttribution prefers an explicit utm_source over referrer', () => {
  assert.equal(classifyAttribution({ utm_source: 'Peer-Slack', referrer_host: 'www.google.com' }), 'peer-slack')
})

test('classifyAttribution lowercases and trims utm_source', () => {
  assert.equal(classifyAttribution({ utm_source: '  Warm-Outreach  ' }), 'warm-outreach')
})

test('classifyAttribution buckets Google/Bing/DuckDuckGo referrers as organic-search', () => {
  assert.equal(classifyAttribution({ referrer_host: 'www.google.com' }), 'organic-search')
  assert.equal(classifyAttribution({ referrer_host: 'www.bing.com' }), 'organic-search')
  assert.equal(classifyAttribution({ referrer_host: 'duckduckgo.com' }), 'organic-search')
})

test('classifyAttribution buckets Slack referrers as peer-slack', () => {
  assert.equal(classifyAttribution({ referrer_host: 'app.slack.com' }), 'peer-slack')
})

test('classifyAttribution buckets LinkedIn/Twitter/X referrers as social', () => {
  assert.equal(classifyAttribution({ referrer_host: 'www.linkedin.com' }), 'social')
  assert.equal(classifyAttribution({ referrer_host: 't.co' }), 'referral-t.co') // t.co is not x.com/twitter.com itself
  assert.equal(classifyAttribution({ referrer_host: 'x.com' }), 'social')
})

test('classifyAttribution falls back to a referral-<host> bucket for unrecognized referrers', () => {
  assert.equal(classifyAttribution({ referrer_host: 'www.news.ycombinator.com' }), 'referral-news.ycombinator.com')
})

test('classifyAttribution returns direct when nothing is present', () => {
  assert.equal(classifyAttribution({}), 'direct')
  assert.equal(classifyAttribution({ utm_source: '', referrer_host: '' }), 'direct')
})

test('sanitizeAttribution clips fields to 100 chars and trims whitespace', () => {
  const long = 'a'.repeat(200)
  const result = sanitizeAttribution({ utm_source: `  ${long}  ` })
  assert.equal(result.utm_source.length, 100)
  assert.equal(result.utm_source, 'a'.repeat(100))
})

test('sanitizeAttribution turns empty/whitespace-only strings into null', () => {
  const result = sanitizeAttribution({ utm_source: '   ', utm_medium: null, utm_campaign: undefined, referrer_host: '' })
  assert.equal(result.utm_source, null)
  assert.equal(result.utm_medium, null)
  assert.equal(result.utm_campaign, null)
  assert.equal(result.referrer_host, null)
})
