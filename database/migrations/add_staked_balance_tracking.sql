-- Migration: Add staked balance tracking to profiles table
-- Date: November 2, 2025
-- Purpose: Track staked $MINTEDMERCH tokens separately from wallet balance

-- Add columns to track staked balance separately
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS staked_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;

-- Add index for staked balance queries
CREATE INDEX IF NOT EXISTS idx_profiles_staked_balance 
  ON profiles(staked_balance);

-- Add comments for documentation
COMMENT ON COLUMN profiles.staked_balance IS 
  'Amount of $MINTEDMERCH tokens currently staked in staking contract';

COMMENT ON COLUMN profiles.wallet_balance IS 
  'Amount of $MINTEDMERCH tokens in user wallets (not staked)';

COMMENT ON COLUMN profiles.token_balance IS 
  'Total $MINTEDMERCH token balance (wallet_balance + staked_balance)';

-- Note: token_balance will continue to be the total (wallet + staked) for backward compatibility
-- The new columns provide a breakdown for analytics and debugging

