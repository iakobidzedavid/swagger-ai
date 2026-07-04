-- DE Step 11 (Chart Your Competitive Position): capture the real speed-to-launch
-- and brand-fidelity metrics for every storefront generation so the buyer can be
-- shown their own real result plotted against the competitive-position research,
-- instead of just a marketing claim.

ALTER TABLE storefront_requests ADD COLUMN IF NOT EXISTS generation_seconds numeric;
ALTER TABLE storefront_requests ADD COLUMN IF NOT EXISTS brand_fidelity_pct numeric;
ALTER TABLE storefront_requests ADD COLUMN IF NOT EXISTS brand_fidelity_breakdown jsonb;

-- 'partial' status (some but not all products created) is set by
-- /api/storefront/create but was never allowed by the original CHECK
-- constraint — the completion update would fail for any partial run,
-- silently dropping the metrics this migration adds. Widen it.
ALTER TABLE storefront_requests DROP CONSTRAINT IF EXISTS storefront_requests_status_check;
ALTER TABLE storefront_requests ADD CONSTRAINT storefront_requests_status_check
  CHECK (status IN ('queued', 'processing', 'complete', 'partial', 'failed'));

CREATE INDEX IF NOT EXISTS storefront_requests_brand_fidelity_pct_idx ON storefront_requests (brand_fidelity_pct);
