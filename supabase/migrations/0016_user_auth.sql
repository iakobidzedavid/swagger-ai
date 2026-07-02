-- User authentication tables and policies (DE-15 monetization auth layer)

-- users table: synced with Supabase Auth, tracks company account owners
CREATE TABLE IF NOT EXISTS users (
  id                uuid        NOT NULL DEFAULT auth.uid() PRIMARY KEY,
  email             text        UNIQUE NOT NULL,
  company_name      text,
  subscription_tier text        NOT NULL DEFAULT 'free'
                                CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  status            text        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_subscription_tier_idx ON users (subscription_tier);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own record
DROP POLICY IF EXISTS users_auth_self ON users;
CREATE POLICY users_auth_self
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role bypass for admin operations
DROP POLICY IF EXISTS users_service_all ON users;
CREATE POLICY users_service_all
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add owner_id to storefront_requests to link storefronts to users
ALTER TABLE storefront_requests
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS storefront_requests_owner_id_idx ON storefront_requests (owner_id);

-- Update RLS on storefront_requests: users can only access their own storefronts
DROP POLICY IF EXISTS storefront_requests_service_all ON storefront_requests;
CREATE POLICY storefront_requests_service_all
  ON storefront_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can only see/modify their own storefronts
DROP POLICY IF EXISTS storefront_requests_auth_owner ON storefront_requests;
CREATE POLICY storefront_requests_auth_owner
  ON storefront_requests
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Anonymous users cannot access storefronts (only authenticated users)
DROP POLICY IF EXISTS storefront_requests_public_read ON storefront_requests;
CREATE POLICY storefront_requests_public_read
  ON storefront_requests
  FOR SELECT
  TO anon
  USING (false);
