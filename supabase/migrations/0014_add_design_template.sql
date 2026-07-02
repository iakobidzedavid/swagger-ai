-- Add design_template column to storefront_requests table
-- Supports the design customization flow where users can select between:
-- minimal, bold, corporate, vibrant design templates

ALTER TABLE storefront_requests ADD COLUMN IF NOT EXISTS design_template text DEFAULT 'minimal';

-- Update the status check constraint to include design-related states if needed
-- (Not needed here, but documented for future expansion)

-- Create index for design_template queries if needed for analytics
CREATE INDEX IF NOT EXISTS storefront_requests_design_template_idx ON storefront_requests (design_template);
