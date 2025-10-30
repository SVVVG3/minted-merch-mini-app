-- Add Bankr wallet address fields to profiles table
-- This migration adds columns to store wallet addresses from Bankr API

-- Add Bankr wallet address columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bankr_account_id TEXT,
ADD COLUMN IF NOT EXISTS bankr_evm_address TEXT,
ADD COLUMN IF NOT EXISTS bankr_solana_address TEXT,
ADD COLUMN IF NOT EXISTS bankr_wallet_data_updated_at TIMESTAMPTZ;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_bankr_account_id ON profiles(bankr_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_bankr_evm_address ON profiles(bankr_evm_address);
CREATE INDEX IF NOT EXISTS idx_profiles_bankr_solana_address ON profiles(bankr_solana_address);

-- Add comments for documentation
COMMENT ON COLUMN profiles.bankr_account_id IS 'Bankr account ID from Bankr API';
COMMENT ON COLUMN profiles.bankr_evm_address IS 'EVM wallet address from Bankr API';
COMMENT ON COLUMN profiles.bankr_solana_address IS 'Solana wallet address from Bankr API';
COMMENT ON COLUMN profiles.bankr_wallet_data_updated_at IS 'When Bankr wallet data was last fetched';
