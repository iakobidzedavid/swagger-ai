-- Enhance domain_submissions and brand_cache tables for rich Brandfetch data support
-- Adds columns to store color palettes, fonts, brand source, and Brandfetch metadata
-- These columns make rich brand data queryable and expose Brandfetch data quality

-- domain_submissions: Add columns for Brandfetch-enriched data
ALTER TABLE domain_submissions
  ADD COLUMN IF NOT EXISTS brand_source text,
  ADD COLUMN IF NOT EXISTS color_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS font_count integer DEFAULT 0;

-- brand_cache: Add columns for Brandfetch-enriched data
ALTER TABLE brand_cache
  ADD COLUMN IF NOT EXISTS brand_source text,
  ADD COLUMN IF NOT EXISTS color_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS font_count integer DEFAULT 0;

-- Add indexes for new queryable columns
CREATE INDEX IF NOT EXISTS domain_submissions_brand_source_idx
  ON domain_submissions (brand_source);

CREATE INDEX IF NOT EXISTS brand_cache_brand_source_idx
  ON brand_cache (brand_source);

-- Add comments for documentation
COMMENT ON COLUMN domain_submissions.brand_source
  IS 'Brand detection source: "brandfetch", "favicon", "theme-color", or "fallback"';

COMMENT ON COLUMN domain_submissions.color_count
  IS 'Number of colors in palette from Brandfetch API (0 for keyless)';

COMMENT ON COLUMN domain_submissions.font_count
  IS 'Number of fonts from Brandfetch API (0 for keyless)';

COMMENT ON COLUMN brand_cache.brand_source
  IS 'Brand detection source: "brandfetch", "favicon", "theme-color", or "fallback"';

COMMENT ON COLUMN brand_cache.color_count
  IS 'Number of colors in palette from Brandfetch API (0 for keyless)';

COMMENT ON COLUMN brand_cache.font_count
  IS 'Number of fonts from Brandfetch API (0 for keyless)';
