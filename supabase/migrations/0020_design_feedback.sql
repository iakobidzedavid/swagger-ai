-- Design feedback table: captures the closed-loop outcome signal (brand -> AI design -> employee purchase -> feedback)
-- that is Swagger AI's proprietary core asset (DE Step 10: Define Your Core).
-- Each row is a real employee response tied to a real order, aggregated per-domain into a live Brand Fidelity Score.
CREATE TABLE IF NOT EXISTS design_feedback (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id              uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  domain                text        NOT NULL,
  brand_accuracy_rating integer     NOT NULL CHECK (brand_accuracy_rating BETWEEN 1 AND 5),
  would_reorder         boolean     NOT NULL,
  comment               text        CHECK (char_length(comment) <= 1000),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- One feedback submission per order (the widget is shown once per completed order)
CREATE UNIQUE INDEX IF NOT EXISTS design_feedback_order_id_key ON design_feedback (order_id);
CREATE INDEX IF NOT EXISTS design_feedback_domain_idx ON design_feedback (domain);
CREATE INDEX IF NOT EXISTS design_feedback_created_at_idx ON design_feedback (created_at DESC);

ALTER TABLE design_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS design_feedback_service_all ON design_feedback;
CREATE POLICY design_feedback_service_all
  ON design_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
