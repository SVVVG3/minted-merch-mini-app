-- Migration: Add connected wallet addresses for dGEN1/Web3Modal wallets
-- Date: October 2025
-- Purpose: Store user-connected wallets separately from Farcaster verified wallets for proper labeling

-- Add connected_eth_addresses column to store dGEN1/Web3Modal wallets
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS connected_eth_addresses JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient searching
CREATE INDEX IF NOT EXISTS idx_profiles_connected_eth_addresses ON profiles USING GIN (connected_eth_addresses);

-- Add comment to document the purpose
COMMENT ON COLUMN profiles.connected_eth_addresses IS 'Ethereum addresses connected via dGEN1/Web3Modal (not Farcaster verified)';

