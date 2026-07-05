-- email.ts previously faked "sent" status without ever calling a real email
-- provider. Now that sendEmail() does a real Gmail send via Pica's HTTP
-- passthrough API, capture the real provider message id returned on success
-- so a "sent" row is independently verifiable (not just a status flag).
ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS email_notifications_provider_message_id_idx
  ON email_notifications (provider_message_id);
