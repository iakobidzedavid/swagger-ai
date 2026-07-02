/**
 * Shared brand utilities for both client and server code.
 * Validation, normalization, and cache TTL logic.
 */

// Matches the format check used by /api/domain/validate and /api/domain/submit.
export const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

// A company's logo/brand colors change rarely. /onboard and /api/domain/submit
// still run their own live fetch for the record that actually gets persisted,
// so a stale preview color for up to 24h has no correctness impact on data
// that matters — this cache only serves the throwaway homepage preview.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** True when a cache row's `fetched_at` is still within the TTL window as of
 * `nowMs`. Exported (pure, no I/O) so it's unit-testable without a live
 * Supabase connection — see tests/brand-cache.test.mjs. */
export function isCacheFresh(fetchedAtIso: string, nowMs: number): boolean {
  const age = nowMs - new Date(fetchedAtIso).getTime()
  return age <= CACHE_TTL_MS
}
