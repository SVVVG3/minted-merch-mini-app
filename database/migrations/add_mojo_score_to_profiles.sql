-- Migration to add mojo_score to profiles table
-- Mojo Score is a composite score combining multiple factors:
-- - Neynar Score (10%)
-- - Quotient Score (20%)
-- - Staking Amount (25%)
-- - Holdings (5%)
-- - Purchase $ Amount (25%)
-- - Check-in Engagement (15%)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS mojo_score NUMERIC(4,3) DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.mojo_score IS 'Minted Merch Mojo Score (0-1 scale) - composite reputation/engagement score';

