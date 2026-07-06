-- Link drop winners to design_order_requests / Printful draft orders

ALTER TABLE design_order_requests
  ADD COLUMN IF NOT EXISTS drop_id UUID REFERENCES weekly_drops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drop_submission_id UUID REFERENCES drop_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS design_order_requests_drop_id_idx ON design_order_requests(drop_id);
CREATE UNIQUE INDEX IF NOT EXISTS design_order_requests_drop_submission_id_unique
  ON design_order_requests(drop_submission_id) WHERE drop_submission_id IS NOT NULL;

ALTER TABLE weekly_drops
  ADD COLUMN IF NOT EXISTS design_request_id UUID REFERENCES design_order_requests(id) ON DELETE SET NULL;
