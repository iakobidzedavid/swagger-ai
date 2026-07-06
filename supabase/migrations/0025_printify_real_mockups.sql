-- Real Printify mockups: track when a product's photo is Printify's own
-- rendered mockup (logo actually printed onto the garment/mug by Printify's
-- print-file + mockup renderer) versus a stock catalog photo that the
-- frontend still has to CSS-overlay a logo sticker onto.
--
-- Before this, every product stored only the flat Printify catalog stock
-- photo in image_url, and the frontend (ProductPhotoOverlay) pasted a
-- translucent logo chip on top of it via absolute-positioned CSS — which
-- reads as a sticker and can land anywhere on the photo, including a
-- model's face. These columns let the create-product pipeline record a
-- REAL Printify-rendered mockup when one was successfully generated, and
-- let the frontend skip the CSS overlay entirely for those rows.
ALTER TABLE printify_products ADD COLUMN IF NOT EXISTS mockup_image_url text;
ALTER TABLE printify_products ADD COLUMN IF NOT EXISTS is_real_mockup boolean NOT NULL DEFAULT false;
ALTER TABLE printify_products ADD COLUMN IF NOT EXISTS printify_blueprint_id text;
ALTER TABLE printify_products ADD COLUMN IF NOT EXISTS printify_print_provider_id text;
ALTER TABLE printify_products ADD COLUMN IF NOT EXISTS printify_variant_id text;

CREATE INDEX IF NOT EXISTS printify_products_is_real_mockup_idx ON printify_products (is_real_mockup);
