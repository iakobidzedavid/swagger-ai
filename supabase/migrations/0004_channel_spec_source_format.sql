-- API specs can be uploaded as JSON or YAML (most real-world OpenAPI/Swagger
-- documents are YAML). Track which source syntax the upload was written in so
-- the admin UI can show it, without altering the existing jsonb-parsed shape.
ALTER TABLE swag_channel_api_specs
  ADD COLUMN IF NOT EXISTS source_format text NOT NULL DEFAULT 'json'
  CHECK (source_format IN ('json', 'yaml'));
