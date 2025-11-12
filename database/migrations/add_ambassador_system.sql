-- Add Ambassador System Migration
-- Adds ambassador bounty program with submissions and payouts
-- Created: November 12, 2025

-- ============================================================================
-- TABLE 1: ambassadors
-- ============================================================================
-- Stores ambassador profiles tied to Farcaster IDs
-- Wallet addresses are retrieved from existing profiles/connected_wallets tables

CREATE TABLE IF NOT EXISTS ambassadors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL REFERENCES profiles(fid) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  total_earned_tokens BIGINT DEFAULT 0, -- Total lifetime earnings in $mintedmerch tokens
  total_bounties_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optional metadata
  notes TEXT -- Admin notes about this ambassador
);

-- Indexes for ambassadors table
CREATE INDEX IF NOT EXISTS idx_ambassadors_fid ON ambassadors(fid);
CREATE INDEX IF NOT EXISTS idx_ambassadors_is_active ON ambassadors(is_active);

-- Enable RLS for ambassadors
ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ambassadors
CREATE POLICY "Ambassadors can view their own profile" ON ambassadors
  FOR SELECT USING (fid = current_setting('app.current_fid', true)::integer);

CREATE POLICY "Admins can manage ambassadors" ON ambassadors
  FOR ALL USING (current_setting('app.is_admin', true)::boolean = true);

-- Trigger to update updated_at for ambassadors
CREATE TRIGGER update_ambassadors_updated_at 
  BEFORE UPDATE ON ambassadors 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE ambassadors IS 'Ambassador profiles for bounty program - linked to Farcaster profiles';
COMMENT ON COLUMN ambassadors.total_earned_tokens IS 'Total lifetime earnings in $mintedmerch tokens';
COMMENT ON COLUMN ambassadors.total_bounties_completed IS 'Count of approved bounty submissions';

-- ============================================================================
-- TABLE 2: bounties
-- ============================================================================
-- Stores bounty campaigns created by admins

CREATE TABLE IF NOT EXISTS bounties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL, -- What needs to be done
  proof_requirements TEXT NOT NULL, -- What proof is needed (link to Farcaster/X/TikTok/Instagram)
  reward_tokens BIGINT NOT NULL, -- Payout amount in $mintedmerch tokens
  max_completions INTEGER NOT NULL CHECK (max_completions > 0), -- How many times this can be completed
  current_completions INTEGER DEFAULT 0 CHECK (current_completions >= 0), -- How many times it's been completed
  is_active BOOLEAN DEFAULT TRUE, -- Can new submissions be made?
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date
  
  -- Metadata
  created_by_admin_fid INTEGER, -- Which admin created it
  category TEXT, -- E.g., 'content', 'social', 'community', 'engagement'
  image_url TEXT -- Optional bounty image
);

-- Indexes for bounties table
CREATE INDEX IF NOT EXISTS idx_bounties_is_active ON bounties(is_active);
CREATE INDEX IF NOT EXISTS idx_bounties_category ON bounties(category);
CREATE INDEX IF NOT EXISTS idx_bounties_created_at ON bounties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bounties_expires_at ON bounties(expires_at);

-- Enable RLS for bounties
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bounties
CREATE POLICY "Ambassadors can view active bounties" ON bounties
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage bounties" ON bounties
  FOR ALL USING (current_setting('app.is_admin', true)::boolean = true);

-- Trigger to update updated_at for bounties
CREATE TRIGGER update_bounties_updated_at 
  BEFORE UPDATE ON bounties 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE bounties IS 'Bounty campaigns for ambassadors to complete';
COMMENT ON COLUMN bounties.reward_tokens IS 'Reward amount in $mintedmerch tokens';
COMMENT ON COLUMN bounties.max_completions IS 'Maximum number of times this bounty can be completed';
COMMENT ON COLUMN bounties.current_completions IS 'Current number of approved submissions';

-- ============================================================================
-- TABLE 3: bounty_submissions
-- ============================================================================
-- Stores submissions from ambassadors

CREATE TABLE IF NOT EXISTS bounty_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bounty_id UUID NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
  ambassador_id UUID NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  
  -- Submission data
  proof_url TEXT NOT NULL, -- Link to proof (Farcaster/X/TikTok/Instagram post)
  proof_description TEXT, -- Optional description from ambassador
  submission_notes TEXT, -- Additional notes
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT, -- Admin feedback on submission
  reviewed_by_admin_fid INTEGER, -- Which admin reviewed it
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one submission per ambassador per bounty
  UNIQUE(bounty_id, ambassador_id)
);

-- Indexes for bounty_submissions table
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_bounty_id ON bounty_submissions(bounty_id);
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_ambassador_id ON bounty_submissions(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_status ON bounty_submissions(status);
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_submitted_at ON bounty_submissions(submitted_at DESC);

-- Enable RLS for bounty_submissions
ALTER TABLE bounty_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bounty_submissions
CREATE POLICY "Ambassadors can view own submissions" ON bounty_submissions
  FOR SELECT USING (
    ambassador_id IN (
      SELECT id FROM ambassadors WHERE fid = current_setting('app.current_fid', true)::integer
    )
  );

CREATE POLICY "Ambassadors can create submissions" ON bounty_submissions
  FOR INSERT WITH CHECK (
    ambassador_id IN (
      SELECT id FROM ambassadors WHERE fid = current_setting('app.current_fid', true)::integer
    )
  );

CREATE POLICY "Admins can manage submissions" ON bounty_submissions
  FOR ALL USING (current_setting('app.is_admin', true)::boolean = true);

-- Trigger to update updated_at for bounty_submissions
CREATE TRIGGER update_bounty_submissions_updated_at 
  BEFORE UPDATE ON bounty_submissions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE bounty_submissions IS 'Ambassador submissions for bounty completion';
COMMENT ON COLUMN bounty_submissions.proof_url IS 'URL to proof (Farcaster/X/TikTok/Instagram post)';
COMMENT ON COLUMN bounty_submissions.status IS 'Submission status: pending, approved, or rejected';

-- ============================================================================
-- TABLE 4: ambassador_payouts
-- ============================================================================
-- Tracks payouts to ambassadors

CREATE TABLE IF NOT EXISTS ambassador_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  bounty_submission_id UUID REFERENCES bounty_submissions(id) ON DELETE SET NULL,
  
  -- Payout details
  amount_tokens BIGINT NOT NULL CHECK (amount_tokens > 0), -- Amount in $mintedmerch tokens
  wallet_address TEXT, -- Recipient wallet address (copied from profile at creation)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transaction_hash TEXT, -- On-chain transaction hash (if sent)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Admin tracking
  processed_by_admin_fid INTEGER,
  notes TEXT
);

-- Indexes for ambassador_payouts table
CREATE INDEX IF NOT EXISTS idx_ambassador_payouts_ambassador_id ON ambassador_payouts(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_payouts_status ON ambassador_payouts(status);
CREATE INDEX IF NOT EXISTS idx_ambassador_payouts_created_at ON ambassador_payouts(created_at DESC);

-- Enable RLS for ambassador_payouts
ALTER TABLE ambassador_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ambassador_payouts
CREATE POLICY "Ambassadors can view own payouts" ON ambassador_payouts
  FOR SELECT USING (
    ambassador_id IN (
      SELECT id FROM ambassadors WHERE fid = current_setting('app.current_fid', true)::integer
    )
  );

CREATE POLICY "Admins can manage payouts" ON ambassador_payouts
  FOR ALL USING (current_setting('app.is_admin', true)::boolean = true);

-- Comments for documentation
COMMENT ON TABLE ambassador_payouts IS 'Payout records for ambassador bounty completions';
COMMENT ON COLUMN ambassador_payouts.amount_tokens IS 'Payout amount in $mintedmerch tokens';
COMMENT ON COLUMN ambassador_payouts.wallet_address IS 'Recipient wallet (copied from profile at creation)';
COMMENT ON COLUMN ambassador_payouts.transaction_hash IS 'On-chain transaction hash for completed payouts';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- - Created ambassadors table (profiles for bounty program)
-- - Created bounties table (campaigns with token rewards)
-- - Created bounty_submissions table (ambassador submissions with approval flow)
-- - Created ambassador_payouts table (manual token distribution tracking)
-- - All tables have RLS policies for data security
-- - Indexes added for performance
-- - Triggers for updated_at timestamps

