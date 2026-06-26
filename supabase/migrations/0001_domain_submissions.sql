-- Domain submissions table: captures every domain-paste event with brand detection results
CREATE TABLE IF NOT EXISTS domain_submissions (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain      text        NOT NULL,
  company_name text,
  logo_url    text,
  primary_color   text,
  secondary_color text,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'fetching', 'detected', 'failed')),
  raw_brand_data  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS domain_submissions_domain_idx ON domain_submissions (domain);
CREATE INDEX IF NOT EXISTS domain_submissions_created_at_idx ON domain_submissions (created_at DESC);

ALTER TABLE domain_submissions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; anon users get no access (submissions are internal)
DROP POLICY IF EXISTS domain_submissions_service_all ON domain_submissions;
CREATE POLICY domain_submissions_service_all
  ON domain_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
