-- Make order_id nullable in email_notifications table
-- This allows non-order emails (marketing, onboarding, etc.) to be logged
ALTER TABLE email_notifications
  ALTER COLUMN order_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL
ALTER TABLE email_notifications
  DROP CONSTRAINT email_notifications_order_id_fkey;

ALTER TABLE email_notifications
  ADD CONSTRAINT email_notifications_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
