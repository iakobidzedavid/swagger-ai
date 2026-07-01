-- Printify products: tracks created products for storefronts
CREATE TABLE IF NOT EXISTS printify_products (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_request_id uuid        REFERENCES storefront_requests(id) ON DELETE CASCADE,
  printify_id           text        UNIQUE, -- Printify's product ID
  name                  text        NOT NULL,
  description           text,
  category              text, -- e.g., 'apparel', 'drinkware'
  image_url             text,
  price_usd             numeric(10, 2),
  sku                   text,
  brand_color_primary   text,
  brand_color_secondary text,
  status                text        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'archived')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS printify_products_storefront_idx ON printify_products (storefront_request_id);
CREATE INDEX IF NOT EXISTS printify_products_category_idx ON printify_products (category);
CREATE INDEX IF NOT EXISTS printify_products_status_idx ON printify_products (status);

ALTER TABLE printify_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS printify_products_service_all ON printify_products;
CREATE POLICY printify_products_service_all
  ON printify_products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
