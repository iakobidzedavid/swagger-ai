-- Storefront generation requests: tracks user-initiated store generation intent
CREATE TABLE IF NOT EXISTS storefront_requests (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_submission_id  uuid        REFERENCES domain_submissions(id) ON DELETE SET NULL,
  domain                text        NOT NULL,
  company_name          text,
  logo_url              text,
  primary_color         text,
  secondary_color       text,
  contact_name          text,
  contact_email         text,
  status                text        NOT NULL DEFAULT 'queued'
                                    CHECK (status IN ('queued', 'processing', 'complete', 'failed')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storefront_requests_domain_idx ON storefront_requests (domain);
CREATE INDEX IF NOT EXISTS storefront_requests_status_idx ON storefront_requests (status);
CREATE INDEX IF NOT EXISTS storefront_requests_created_at_idx ON storefront_requests (created_at DESC);

ALTER TABLE storefront_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storefront_requests_service_all ON storefront_requests;
CREATE POLICY storefront_requests_service_all
  ON storefront_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
