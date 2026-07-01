-- Real API-documentation import: specs can now be pulled directly from a
-- partner's live OpenAPI/Swagger URL instead of only pasted/uploaded text.
-- Track the source URL for provenance so the admin UI can show where an
-- imported spec came from and re-fetch it later.
ALTER TABLE swag_channel_api_specs
  ADD COLUMN IF NOT EXISTS source_url text;

CREATE INDEX IF NOT EXISTS swag_channel_api_specs_source_url_idx
  ON swag_channel_api_specs (source_url)
  WHERE source_url IS NOT NULL;
