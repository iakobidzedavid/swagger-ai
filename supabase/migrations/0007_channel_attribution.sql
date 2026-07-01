-- Revenue engine attribution (DE-18): link real domain-submission traffic to the
-- acquisition channels seeded in 0003_acquisition_channels.sql. Without this,
-- "channels" are static metadata with no way to measure which one actually
-- drives a paste. attribution_key is the stable join key between a channel and
-- the submissions it produced (either an explicit ?utm_source= tag on a real
-- outbound link, or a referrer-derived classification for organic traffic).

ALTER TABLE swag_acquisition_channels
  ADD COLUMN IF NOT EXISTS attribution_key text UNIQUE;

-- Map each already-seeded channel to the tag its real links should carry, or
-- (for organic/direct channels) the value our referrer classifier produces.
UPDATE swag_acquisition_channels SET attribution_key = 'warm-outreach'        WHERE name = 'Warm intro & targeted outreach';
UPDATE swag_acquisition_channels SET attribution_key = 'design-partner-pilot' WHERE name = 'Design-partner pilot cohort';
UPDATE swag_acquisition_channels SET attribution_key = 'peer-slack'          WHERE name = 'Slack / peer referral';
UPDATE swag_acquisition_channels SET attribution_key = 'organic-search'      WHERE name = 'Organic search (Google)';
UPDATE swag_acquisition_channels SET attribution_key = 'direct'              WHERE name = 'Self-serve PLG funnel';

ALTER TABLE domain_submissions
  ADD COLUMN IF NOT EXISTS utm_source     text,
  ADD COLUMN IF NOT EXISTS utm_medium     text,
  ADD COLUMN IF NOT EXISTS utm_campaign   text,
  ADD COLUMN IF NOT EXISTS referrer_host  text,
  ADD COLUMN IF NOT EXISTS attribution_key text;

CREATE INDEX IF NOT EXISTS domain_submissions_attribution_key_idx
  ON domain_submissions (attribution_key);
