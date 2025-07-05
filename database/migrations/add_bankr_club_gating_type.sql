-- Migration: Add Bankr Club gating type to token gating system
-- Date: January 2025
-- Purpose: Enable Bankr Club membership as a token gating option for discounts

-- Add 'bankr_club' to the gating_type CHECK constraint
ALTER TABLE discount_codes 
DROP CONSTRAINT IF EXISTS discount_codes_gating_type_check,
ADD CONSTRAINT discount_codes_gating_type_check 
CHECK (gating_type IN ('none', 'nft_holding', 'token_balance', 'whitelist_wallet', 'whitelist_fid', 'combined', 'bankr_club'));

-- Update the comment to reflect the new gating type
COMMENT ON COLUMN discount_codes.gating_type IS 'Type of token-gating: none, nft_holding, token_balance, whitelist_wallet, whitelist_fid, combined, bankr_club';

-- Add index for efficient bankr_club gating queries
CREATE INDEX IF NOT EXISTS idx_discount_codes_gating_type_bankr_club ON discount_codes(gating_type) WHERE gating_type = 'bankr_club';

-- Add comment for documentation
COMMENT ON CONSTRAINT discount_codes_gating_type_check ON discount_codes IS 'Ensures gating_type is one of the supported token gating methods including Bankr Club membership'; 