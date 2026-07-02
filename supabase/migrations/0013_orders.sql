-- Orders table: tracks completed purchases
CREATE TABLE IF NOT EXISTS orders (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id         uuid        NOT NULL,
  domain                text        NOT NULL,
  customer_email        text        NOT NULL,
  customer_name         text,
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city         text,
  shipping_state        text,
  shipping_zip          text,
  shipping_country      text,
  total_amount_cents    integer     NOT NULL,
  currency              text        NOT NULL DEFAULT 'usd',
  swagger_fee_cents     integer     NOT NULL,
  vendor_payout_cents   integer     NOT NULL,
  payment_method        text,
  transaction_id        text,
  printify_order_id     text,
  status                text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_storefront_id_idx ON orders (storefront_id);
CREATE INDEX IF NOT EXISTS orders_domain_idx ON orders (domain);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders (customer_email);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_service_all ON orders;
CREATE POLICY orders_service_all
  ON orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Order items table: tracks what products were in each order
CREATE TABLE IF NOT EXISTS order_items (
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

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items (product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_service_all ON order_items;
CREATE POLICY order_items_service_all
  ON order_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
