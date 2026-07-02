-- Storefront settings: enhance storefront_requests with additional management fields
-- Idempotent migration - only adds columns if they don't exist

ALTER TABLE storefront_requests
ADD COLUMN IF NOT EXISTS store_name text,
ADD COLUMN IF NOT EXISTS store_description text,
ADD COLUMN IF NOT EXISTS customization_json jsonb DEFAULT '{}'::jsonb;

-- Create an index on domain for faster lookups
CREATE INDEX IF NOT EXISTS storefront_requests_domain_idx ON storefront_requests (domain DESC);
