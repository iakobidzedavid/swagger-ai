-- 404 Analytics: track page not found events to identify broken links and UX issues
-- Enables analytics-driven debugging of redirect chains and missing routes
--
-- Stores: each 404 hit with timestamp, attempted path, referrer, user context
-- Enables: analytics dashboard to surface top broken links, redirect chains, traffic patterns
-- Pattern: RLS-protected, service role only (same as domain_submissions and health_alerts)

CREATE TABLE IF NOT EXISTS not_found_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_path text NOT NULL,
  referrer text,
  user_agent text,
  ip_address text,
  status_code int NOT NULL DEFAULT 404,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer_host text,
  attribution_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS not_found_events_created_at_idx ON not_found_events (created_at DESC);
CREATE INDEX IF NOT EXISTS not_found_events_attempted_path_idx ON not_found_events (attempted_path);
CREATE INDEX IF NOT EXISTS not_found_events_referrer_idx ON not_found_events (referrer);
CREATE INDEX IF NOT EXISTS not_found_events_utm_source_idx ON not_found_events (utm_source);

-- RLS: only service role can insert/read (same as domain_submissions)
ALTER TABLE not_found_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON not_found_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
