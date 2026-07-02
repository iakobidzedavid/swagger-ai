-- Printify accounts: stores user OAuth tokens and shop connections
CREATE TABLE IF NOT EXISTS printify_accounts (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain               text        NOT NULL UNIQUE, -- company domain (e.g., acme.com)
  shop_id              text        NOT NULL, -- Printify shop ID
  shop_title           text, -- Printify shop name
  access_token         text, -- OAuth access token (encrypted in production)
  refresh_token        text, -- OAuth refresh token (encrypted in production)
  token_expires_at     timestamptz, -- When the access token expires
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS printify_accounts_domain_idx ON printify_accounts (domain);
CREATE INDEX IF NOT EXISTS printify_accounts_shop_id_idx ON printify_accounts (shop_id);

ALTER TABLE printify_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS printify_accounts_service_all ON printify_accounts;
CREATE POLICY printify_accounts_service_all
  ON printify_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
