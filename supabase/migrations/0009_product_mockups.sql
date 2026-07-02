-- Product mockups cache: stores generated branded product mockup images
CREATE TABLE IF NOT EXISTS product_mockups (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id        text        NOT NULL,
  domain            text        NOT NULL,
  company_name      text,
  primary_color     text        NOT NULL,
  secondary_color   text        NOT NULL,
  logo_url          text,
  mockup_svg        text        NOT NULL,
  mockup_data_url   text,
  mockup_cache_key  text        NOT NULL UNIQUE,
  product_title     text,
  product_category  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_mockups_cache_key_idx ON product_mockups (mockup_cache_key);
CREATE INDEX IF NOT EXISTS product_mockups_domain_idx ON product_mockups (domain);
CREATE INDEX IF NOT EXISTS product_mockups_product_idx ON product_mockups (product_id);

ALTER TABLE product_mockups ENABLE ROW LEVEL SECURITY;

-- Service role can read/write all mockups
DROP POLICY IF EXISTS product_mockups_service_all ON product_mockups;
CREATE POLICY product_mockups_service_all
  ON product_mockups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
