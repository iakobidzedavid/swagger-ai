-- Stripe subscription tracking (DE-16 Pro tier pricing)

-- subscriptions table: tracks Stripe subscription state per user
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id    text        UNIQUE NOT NULL,
  stripe_subscription_id text       UNIQUE NOT NULL,
  stripe_price_id       text        NOT NULL,
  status                text        NOT NULL
                                    CHECK (status IN ('active', 'past_due', 'unpaid', 'canceled', 'incomplete')),
  tier                  text        NOT NULL DEFAULT 'pro'
                                    CHECK (tier IN ('pro', 'enterprise')),
  current_period_start  timestamptz NOT NULL,
  current_period_end    timestamptz NOT NULL,
  cancel_at             timestamptz,
  canceled_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
DROP POLICY IF EXISTS subscriptions_auth_self ON subscriptions;
CREATE POLICY subscriptions_auth_self
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role bypass for webhook updates
DROP POLICY IF EXISTS subscriptions_service_all ON subscriptions;
CREATE POLICY subscriptions_service_all
  ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- payment_intents table: track payment attempts (for analytics/debugging)
CREATE TABLE IF NOT EXISTS payment_intents (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid        REFERENCES users(id) ON DELETE SET NULL,
  stripe_payment_intent_id text      UNIQUE NOT NULL,
  amount                integer     NOT NULL, -- in cents
  currency              text        NOT NULL DEFAULT 'usd',
  status                text        NOT NULL
                                    CHECK (status IN ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'succeeded', 'canceled')),
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_intents_user_id_idx ON payment_intents (user_id);
CREATE INDEX IF NOT EXISTS payment_intents_stripe_id_idx ON payment_intents (stripe_payment_intent_id);

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- Service role only
DROP POLICY IF EXISTS payment_intents_service_all ON payment_intents;
CREATE POLICY payment_intents_service_all
  ON payment_intents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
