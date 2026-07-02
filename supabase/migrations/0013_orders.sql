-- Orders table: tracks completed purchases (self-healing migration)
-- Drop existing tables if they exist to ensure clean recreation
-- (handles stale/incomplete schema from earlier runs)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Create orders table with all required columns and constraints
CREATE TABLE orders (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id         uuid        NOT NULL REFERENCES storefront_requests(id) ON DELETE RESTRICT,
  domain                text        NOT NULL,
  customer_email        text        NOT NULL,
  customer_name         text,
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city         text,
  shipping_state        text,
  shipping_zip          text,
  shipping_country      text,
  total_amount_cents    integer     NOT NULL CHECK (total_amount_cents > 0),
  currency              text        NOT NULL DEFAULT 'usd',
  swagger_fee_cents     integer     NOT NULL CHECK (swagger_fee_cents >= 0),
  vendor_payout_cents   integer     NOT NULL CHECK (vendor_payout_cents >= 0),
  payment_method        text,
  transaction_id        text,
  printify_order_id     text,
  status                text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for query performance
CREATE INDEX orders_storefront_id_idx ON orders (storefront_id);
CREATE INDEX orders_domain_idx ON orders (domain);
CREATE INDEX orders_customer_email_idx ON orders (customer_email);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_created_at_idx ON orders (created_at DESC);

-- Enable RLS and grant service_role full access
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_service_all
  ON orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Order items table: tracks what products were in each order
CREATE TABLE order_items (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id              uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            text        NOT NULL,
  product_name          text        NOT NULL,
  product_sku           text,
  variant_id            text,
  variant_title         text,
  quantity              integer     NOT NULL DEFAULT 1,
  unit_price_cents      integer     NOT NULL,
  total_price_cents     integer     NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for query performance
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX order_items_product_id_idx ON order_items (product_id);

-- Enable RLS and grant service_role full access
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_items_service_all
  ON order_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
