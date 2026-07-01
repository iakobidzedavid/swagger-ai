-- Revenue engine: acquisition channels (DE-18 Map the Sales Process) plus the
-- API/webhook/UTM integration specs that wire each channel into the product.
CREATE TABLE IF NOT EXISTS swag_acquisition_channels (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL UNIQUE,
  horizon       text        NOT NULL
                             CHECK (horizon IN ('short_term', 'medium_term', 'long_term')),
  channel_type  text        NOT NULL,
  description   text        NOT NULL,
  source_de_step text,
  status        text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'planned', 'paused')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS swag_acquisition_channels_horizon_idx ON swag_acquisition_channels (horizon);

ALTER TABLE swag_acquisition_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS swag_acquisition_channels_service_all ON swag_acquisition_channels;
CREATE POLICY swag_acquisition_channels_service_all
  ON swag_acquisition_channels
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- API specifications (OpenAPI docs, webhook configs, or UTM tracking configs)
-- uploaded to wire a partner/channel integration into the acquisition funnel.
CREATE TABLE IF NOT EXISTS swag_channel_api_specs (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id        uuid        NOT NULL REFERENCES swag_acquisition_channels(id) ON DELETE CASCADE,
  spec_format       text        NOT NULL
                                CHECK (spec_format IN ('openapi', 'webhook', 'utm')),
  file_name         text,
  raw_spec          jsonb       NOT NULL,
  parsed_summary    text        NOT NULL,
  parsed_endpoints  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  endpoint_count    integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS swag_channel_api_specs_channel_idx ON swag_channel_api_specs (channel_id);
CREATE INDEX IF NOT EXISTS swag_channel_api_specs_created_at_idx ON swag_channel_api_specs (created_at DESC);

ALTER TABLE swag_channel_api_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS swag_channel_api_specs_service_all ON swag_channel_api_specs;
CREATE POLICY swag_channel_api_specs_service_all
  ON swag_channel_api_specs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed the real, already-documented acquisition channels from the 24-step plan.
-- No invented metrics — these are the channels named in DE-06, DE-09, DE-13, DE-23.
INSERT INTO swag_acquisition_channels (name, horizon, channel_type, description, source_de_step, status)
VALUES
  (
    'Warm intro & targeted outreach',
    'short_term',
    'outbound_referral',
    'Direct warm-intro and targeted outreach to the 10 named Series A-C People Ops prospects (Vanta, Ramp, Linear, Density, Retool, Ashby, Mercury, Census, Modal, Clay).',
    'DE-09',
    'active'
  ),
  (
    'Design-partner pilot cohort',
    'short_term',
    'pilot_program',
    'Hands-on pilot with design-partner companies proving dogs-eat-dog-food GMV (8 pilots, 3 paying via the 18% GMV cut) before scaling acquisition spend.',
    'DE-23',
    'active'
  ),
  (
    'Slack / peer referral',
    'medium_term',
    'word_of_mouth',
    'Peer referral inside People Ops Slack communities, surfaced as the primary discovery trigger in the full life-cycle use case.',
    'DE-06',
    'active'
  ),
  (
    'Organic search (Google)',
    'medium_term',
    'seo_organic',
    'Google search discovery leading into the landing page and 4-minute domain-paste demo described in the acquisition process map.',
    'DE-13',
    'active'
  ),
  (
    'Self-serve PLG funnel',
    'long_term',
    'product_led_growth',
    'Landing page to domain-paste demo to same-session Brex/Ramp card checkout, with no sales call required, per the mapped acquisition process.',
    'DE-13',
    'planned'
  )
ON CONFLICT (name) DO NOTHING;
