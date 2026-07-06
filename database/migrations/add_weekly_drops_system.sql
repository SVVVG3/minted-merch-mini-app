-- Weekly Limited Drops system
-- All tables: RLS enabled, service_role only, deny public direct access

-- ============================================================================
-- weekly_drops
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'voting', 'live', 'sold_out', 'closed')),
  shopify_product_id TEXT,
  shopify_collection_handle TEXT NOT NULL DEFAULT 'limited-drops',
  max_units INTEGER NOT NULL DEFAULT 37,
  units_sold INTEGER NOT NULL DEFAULT 0,
  submissions_open_at TIMESTAMPTZ,
  submissions_close_at TIMESTAMPTZ,
  voting_starts_at TIMESTAMPTZ,
  voting_ends_at TIMESTAMPTZ,
  drop_starts_at TIMESTAMPTZ,
  drop_ends_at TIMESTAMPTZ,
  winning_submission_id UUID,
  creator_payout_per_unit NUMERIC NOT NULL DEFAULT 5000000,
  creator_payout_token TEXT NOT NULL DEFAULT 'mintedmerch',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_drops_status_idx ON weekly_drops(status);
CREATE INDEX IF NOT EXISTS weekly_drops_created_at_idx ON weekly_drops(created_at DESC);

ALTER TABLE weekly_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON weekly_drops FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "deny_all_direct_access"
  ON weekly_drops AS RESTRICTIVE FOR ALL TO public
  USING (false);

-- ============================================================================
-- drop_submissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS drop_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id UUID NOT NULL REFERENCES weekly_drops(id) ON DELETE CASCADE,
  mockup_id UUID NOT NULL REFERENCES design_studio_mockups(id) ON DELETE CASCADE,
  fid INTEGER NOT NULL,
  username TEXT,
  mockup_url TEXT,
  design_url TEXT,
  product_type TEXT,
  color_name TEXT,
  technique TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'finalist', 'winner', 'rejected')),
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (drop_id, fid)
);

CREATE INDEX IF NOT EXISTS drop_submissions_drop_id_idx ON drop_submissions(drop_id);
CREATE INDEX IF NOT EXISTS drop_submissions_fid_idx ON drop_submissions(fid);
CREATE INDEX IF NOT EXISTS drop_submissions_status_idx ON drop_submissions(status);

ALTER TABLE drop_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON drop_submissions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "deny_all_direct_access"
  ON drop_submissions AS RESTRICTIVE FOR ALL TO public
  USING (false);

-- FK from weekly_drops to winning submission (added after drop_submissions exists)
ALTER TABLE weekly_drops
  ADD CONSTRAINT weekly_drops_winning_submission_fkey
  FOREIGN KEY (winning_submission_id) REFERENCES drop_submissions(id) ON DELETE SET NULL;

-- ============================================================================
-- drop_votes
-- ============================================================================
CREATE TABLE IF NOT EXISTS drop_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id UUID NOT NULL REFERENCES weekly_drops(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES drop_submissions(id) ON DELETE CASCADE,
  voter_fid INTEGER NOT NULL,
  vote_weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (drop_id, voter_fid)
);

CREATE INDEX IF NOT EXISTS drop_votes_drop_id_idx ON drop_votes(drop_id);
CREATE INDEX IF NOT EXISTS drop_votes_submission_id_idx ON drop_votes(submission_id);

ALTER TABLE drop_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON drop_votes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "deny_all_direct_access"
  ON drop_votes AS RESTRICTIVE FOR ALL TO public
  USING (false);

-- ============================================================================
-- drop_creator_payouts
-- ============================================================================
CREATE TABLE IF NOT EXISTS drop_creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id UUID NOT NULL REFERENCES weekly_drops(id) ON DELETE CASCADE,
  creator_fid INTEGER NOT NULL,
  units_sold INTEGER NOT NULL DEFAULT 0,
  amount_tokens NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimable', 'completed')),
  wallet_address TEXT,
  claim_signature TEXT,
  claim_deadline TIMESTAMPTZ,
  transaction_hash TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (drop_id)
);

CREATE INDEX IF NOT EXISTS drop_creator_payouts_creator_fid_idx ON drop_creator_payouts(creator_fid);
CREATE INDEX IF NOT EXISTS drop_creator_payouts_status_idx ON drop_creator_payouts(status);

ALTER TABLE drop_creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON drop_creator_payouts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "deny_all_direct_access"
  ON drop_creator_payouts AS RESTRICTIVE FOR ALL TO public
  USING (false);
