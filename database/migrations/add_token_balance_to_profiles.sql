-- Add token balance tracking to profiles table
-- This will store users' $MINTEDMERCH token holdings for leaderboard and caching

-- Add token balance column
ALTER TABLE profiles 
ADD COLUMN token_balance BIGINT DEFAULT 0,
ADD COLUMN token_balance_updated_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient leaderboard queries
CREATE INDEX idx_profiles_token_balance ON profiles (token_balance DESC) WHERE token_balance > 0;

-- Add comment for documentation
COMMENT ON COLUMN profiles.token_balance IS 'User $MINTEDMERCH token balance (in wei/smallest unit)';
COMMENT ON COLUMN profiles.token_balance_updated_at IS 'Timestamp when token balance was last updated';

-- Update RLS policies to allow reading token balance
-- (The existing policies should already cover this, but let's be explicit)
