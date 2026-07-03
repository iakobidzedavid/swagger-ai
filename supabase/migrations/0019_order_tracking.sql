-- Add tracking fields to orders table for Printify shipment integration
-- This allows the order confirmation page to display real tracking details

ALTER TABLE orders ADD COLUMN tracking_number text CHECK (char_length(tracking_number) <= 100);
ALTER TABLE orders ADD COLUMN tracking_carrier text CHECK (char_length(tracking_carrier) <= 50);
ALTER TABLE orders ADD COLUMN tracking_url text CHECK (char_length(tracking_url) <= 2048);
ALTER TABLE orders ADD COLUMN shipped_at timestamptz;
ALTER TABLE orders ADD COLUMN delivered_at timestamptz;

-- Create indexes for faster lookups by tracking number
CREATE INDEX orders_tracking_number_idx ON orders (tracking_number) WHERE tracking_number IS NOT NULL;
