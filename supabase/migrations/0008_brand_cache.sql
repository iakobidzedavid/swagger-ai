-- Brand lookup cache (perf layer on top of Step 22 MVBP brand detection):
-- /api/brand is called on every keystroke-triggered homepage preview and can
-- be re-hit for the same domain seconds apart (a visitor retyping, or two
-- people at the same company both previewing e.g. acme.com). Without this
-- table every lookup re-fetches Google's favicon service AND re-fetches the
-- target company's homepage HTML (theme-color meta tag). This table lets the
-- route return a cached result within a TTL instead of re-fetching externally.
CREATE TABLE IF NOT EXISTS brand_cache (
  domain          text        NOT NULL PRIMARY KEY,
  company_name    text        NOT NULL,
  logo_url        text,
  primary_color   text        NOT NULL,
  secondary_color text        NOT NULL,
  source          text        NOT NULL,
  raw_brand_data  jsonb,
  hit_count       integer     NOT NULL DEFAULT 1,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_cache_fetched_at_idx ON brand_cache (fetched_at DESC);

ALTER TABLE brand_cache ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; anon users get no access (there is
-- no anon key in this project — all reads/writes go through API routes with
-- the service role key), matching every other table in this schema.
DROP POLICY IF EXISTS brand_cache_service_all ON brand_cache;
CREATE POLICY brand_cache_service_all
  ON brand_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
