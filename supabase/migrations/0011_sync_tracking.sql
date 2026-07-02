-- Add sync tracking to printify_products table
ALTER TABLE IF EXISTS printify_products
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add sync status enum for tracking sync state
ALTER TABLE IF EXISTS printify_products
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed'));

-- Create index for querying by sync status
CREATE INDEX IF NOT EXISTS printify_products_sync_status_idx ON printify_products (sync_status);
CREATE INDEX IF NOT EXISTS printify_products_last_synced_idx ON printify_products (last_synced_at);
