-- Add columns for tracking on-chain spin transactions
-- Run this migration to add spin tracking to user_checkins table

ALTER TABLE user_checkins 
ADD COLUMN IF NOT EXISTS spin_reserved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS spin_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS spin_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS spin_nonce TEXT,
ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_checkins_spin_reserved 
ON user_checkins(user_fid, spin_reserved_at) 
WHERE spin_reserved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_checkins_spin_confirmed 
ON user_checkins(user_fid, spin_confirmed_at) 
WHERE spin_confirmed_at IS NOT NULL;

-- Add index for nonce lookups (prevent replay attacks)
CREATE INDEX IF NOT EXISTS idx_user_checkins_spin_nonce 
ON user_checkins(spin_nonce) 
WHERE spin_nonce IS NOT NULL;
