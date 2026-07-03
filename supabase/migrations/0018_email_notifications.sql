-- Email notifications table: tracks sent emails for order confirmations and fulfillment updates
CREATE TABLE email_notifications (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id              uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  recipient_email       text        NOT NULL,
  notification_type     text        NOT NULL
                                    CHECK (notification_type IN ('order_confirmation', 'fulfillment_update', 'shipment_update')),
  status                text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  subject               text,
  sent_at               timestamptz,
  failed_reason         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for query performance
CREATE INDEX email_notifications_order_id_idx ON email_notifications (order_id);
CREATE INDEX email_notifications_recipient_email_idx ON email_notifications (recipient_email);
CREATE INDEX email_notifications_notification_type_idx ON email_notifications (notification_type);
CREATE INDEX email_notifications_status_idx ON email_notifications (status);
CREATE INDEX email_notifications_created_at_idx ON email_notifications (created_at DESC);

-- Enable RLS and grant service_role full access
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_notifications_service_all
  ON email_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
