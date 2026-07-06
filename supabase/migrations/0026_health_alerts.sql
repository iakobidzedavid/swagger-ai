-- Health monitoring table: track /health endpoint 5xx responses and alert status
-- Used for proactive ops monitoring and incident response
--
-- Stores: each 5xx response event with timestamp, status code, error message
-- Tracks: whether an alert was sent to ops (prevent alert spam for cascading failures)
-- Enables: threshold-based alerting (e.g., alert if 3+ failures in 5 minutes)

CREATE TABLE IF NOT EXISTS health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_code int NOT NULL,
  error_message text,
  endpoint text DEFAULT '/health',
  is_alerted boolean NOT NULL DEFAULT false,
  alert_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_alerts_created_at_idx ON health_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS health_alerts_is_alerted_idx ON health_alerts (is_alerted);
CREATE INDEX IF NOT EXISTS health_alerts_status_code_idx ON health_alerts (status_code);

-- RLS: only service role can insert/read (same as domain_submissions)
ALTER TABLE health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON health_alerts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
