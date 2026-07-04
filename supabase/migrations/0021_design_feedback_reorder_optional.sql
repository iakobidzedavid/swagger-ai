-- The "would reorder" question is a bonus signal, not a required field — the widget's
-- core ask is the 1-5 brand-accuracy star rating. Requiring would_reorder blocked
-- submission whenever a shopper only rated + commented without answering it.
ALTER TABLE design_feedback ALTER COLUMN would_reorder DROP NOT NULL;
