-- Migration to add quotient_score to profiles table
-- Quotient Score is a PageRank-based reputation metric for Farcaster

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS quotient_score NUMERIC(4,3) DEFAULT NULL;

-- Add index for querying by quotient score
CREATE INDEX IF NOT EXISTS idx_profiles_quotient_score ON profiles(quotient_score);

COMMENT ON COLUMN profiles.quotient_score IS 'Quotient Score from Quotient Social API (0-1 scale). <0.5=Inactive, 0.5-0.6=Casual, 0.6-0.75=Active, 0.75-0.8=Influential, 0.8-0.89=Elite, 0.9+=Exceptional';

