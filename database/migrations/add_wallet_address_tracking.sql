-- Migration: Add wallet address tracking to profiles table
-- Date: January 2025
-- Purpose: Store user wallet addresses for token gating and user verification

-- Add wallet address columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS custody_address TEXT,
ADD COLUMN IF NOT EXISTS verified_eth_addresses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS verified_sol_addresses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS primary_eth_address TEXT,
ADD COLUMN IF NOT EXISTS primary_sol_address TEXT,
ADD COLUMN IF NOT EXISTS all_wallet_addresses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS wallet_data_updated_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_custody_address ON profiles(custody_address);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_eth_address ON profiles(primary_eth_address);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_sol_address ON profiles(primary_sol_address);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_data_updated_at ON profiles(wallet_data_updated_at);

-- Add GIN indexes for JSONB arrays for efficient searching
CREATE INDEX IF NOT EXISTS idx_profiles_verified_eth_addresses ON profiles USING GIN (verified_eth_addresses);
CREATE INDEX IF NOT EXISTS idx_profiles_verified_sol_addresses ON profiles USING GIN (verified_sol_addresses);
CREATE INDEX IF NOT EXISTS idx_profiles_all_wallet_addresses ON profiles USING GIN (all_wallet_addresses);

-- Add comments to document the purpose of each field
COMMENT ON COLUMN profiles.custody_address IS 'The Farcaster custody address for this user';
COMMENT ON COLUMN profiles.verified_eth_addresses IS 'Array of verified Ethereum addresses from Neynar';
COMMENT ON COLUMN profiles.verified_sol_addresses IS 'Array of verified Solana addresses from Neynar';
COMMENT ON COLUMN profiles.primary_eth_address IS 'Primary Ethereum address from verified_addresses.primary';
COMMENT ON COLUMN profiles.primary_sol_address IS 'Primary Solana address from verified_addresses.primary';
COMMENT ON COLUMN profiles.all_wallet_addresses IS 'All wallet addresses (custody + verified) in lowercase for easy searching';
COMMENT ON COLUMN profiles.wallet_data_updated_at IS 'Last time wallet address data was fetched from Neynar'; 