-- Migration: Add token-gated discount capabilities
-- Date: January 2025
-- Purpose: Extend discount system with NFT/token gating, whitelisting, and product-specific discounts

-- Add new columns to discount_codes table for token-gating
ALTER TABLE discount_codes 
-- Discount scope and targeting
ADD COLUMN IF NOT EXISTS discount_scope TEXT DEFAULT 'site_wide' CHECK (discount_scope IN ('site_wide', 'product', 'collection', 'category')),
ADD COLUMN IF NOT EXISTS target_products JSONB DEFAULT '[]'::jsonb, -- Array of specific product IDs/handles
ADD COLUMN IF NOT EXISTS target_collections JSONB DEFAULT '[]'::jsonb, -- Array of collection IDs
ADD COLUMN IF NOT EXISTS target_categories JSONB DEFAULT '[]'::jsonb, -- Array of category names

-- Token-gating configuration
ADD COLUMN IF NOT EXISTS gating_type TEXT DEFAULT 'none' CHECK (gating_type IN ('none', 'nft_holding', 'token_balance', 'whitelist_wallet', 'whitelist_fid', 'combined')),
ADD COLUMN IF NOT EXISTS gating_config JSONB DEFAULT '{}'::jsonb, -- Flexible config for different gating types

-- Contract and blockchain info for token-gating
ADD COLUMN IF NOT EXISTS contract_addresses JSONB DEFAULT '[]'::jsonb, -- Array of contract addresses to check
ADD COLUMN IF NOT EXISTS chain_ids JSONB DEFAULT '[1]'::jsonb, -- Array of supported chain IDs (1=Ethereum, 8453=Base, etc.)
ADD COLUMN IF NOT EXISTS required_balance DECIMAL(20,8) DEFAULT 1, -- Minimum token/NFT balance required
ADD COLUMN IF NOT EXISTS balance_check_type TEXT DEFAULT 'minimum' CHECK (balance_check_type IN ('minimum', 'exact', 'range')),

-- Whitelist configurations
ADD COLUMN IF NOT EXISTS whitelisted_wallets JSONB DEFAULT '[]'::jsonb, -- Array of wallet addresses
ADD COLUMN IF NOT EXISTS whitelisted_fids JSONB DEFAULT '[]'::jsonb, -- Array of specific FIDs
ADD COLUMN IF NOT EXISTS whitelist_snapshot_date TIMESTAMP WITH TIME ZONE, -- For snapshot-based requirements

-- Usage limitations
ADD COLUMN IF NOT EXISTS max_uses_total INTEGER, -- Total uses across all users (NULL = unlimited)
ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER DEFAULT 1, -- Uses per user
ADD COLUMN IF NOT EXISTS current_total_uses INTEGER DEFAULT 0, -- Track current usage
ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT FALSE, -- Auto-apply if eligible (for token-gated)

-- Advanced features
ADD COLUMN IF NOT EXISTS requires_minimum_order DECIMAL(10,2), -- Minimum order amount required
ADD COLUMN IF NOT EXISTS stackable_with_other_discounts BOOLEAN DEFAULT FALSE, -- Can combine with other discounts
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 0, -- For discount conflict resolution (higher = higher priority)

-- Metadata and tracking
ADD COLUMN IF NOT EXISTS discount_description TEXT, -- Human-readable description
ADD COLUMN IF NOT EXISTS internal_notes TEXT, -- Internal notes for team
ADD COLUMN IF NOT EXISTS campaign_id TEXT, -- Group related discounts
ADD COLUMN IF NOT EXISTS analytics_tag TEXT; -- For tracking performance

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discount_codes_discount_scope ON discount_codes(discount_scope);
CREATE INDEX IF NOT EXISTS idx_discount_codes_gating_type ON discount_codes(gating_type);
CREATE INDEX IF NOT EXISTS idx_discount_codes_auto_apply ON discount_codes(auto_apply);
CREATE INDEX IF NOT EXISTS idx_discount_codes_expires_at ON discount_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_discount_codes_campaign_id ON discount_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_priority_level ON discount_codes(priority_level);
CREATE INDEX IF NOT EXISTS idx_discount_codes_max_uses_total ON discount_codes(max_uses_total);

-- GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_discount_codes_target_products ON discount_codes USING GIN (target_products);
CREATE INDEX IF NOT EXISTS idx_discount_codes_target_collections ON discount_codes USING GIN (target_collections);
CREATE INDEX IF NOT EXISTS idx_discount_codes_contract_addresses ON discount_codes USING GIN (contract_addresses);
CREATE INDEX IF NOT EXISTS idx_discount_codes_whitelisted_wallets ON discount_codes USING GIN (whitelisted_wallets);
CREATE INDEX IF NOT EXISTS idx_discount_codes_whitelisted_fids ON discount_codes USING GIN (whitelisted_fids);
CREATE INDEX IF NOT EXISTS idx_discount_codes_gating_config ON discount_codes USING GIN (gating_config);

-- Add comments for documentation
COMMENT ON COLUMN discount_codes.discount_scope IS 'Scope of discount: site_wide, product, collection, or category';
COMMENT ON COLUMN discount_codes.target_products IS 'Array of specific product IDs/handles this discount applies to';
COMMENT ON COLUMN discount_codes.target_collections IS 'Array of collection IDs this discount applies to';
COMMENT ON COLUMN discount_codes.gating_type IS 'Type of token-gating: none, nft_holding, token_balance, whitelist_wallet, whitelist_fid, combined';
COMMENT ON COLUMN discount_codes.gating_config IS 'Flexible JSON configuration for complex gating rules';
COMMENT ON COLUMN discount_codes.contract_addresses IS 'Array of smart contract addresses to check for token-gating';
COMMENT ON COLUMN discount_codes.chain_ids IS 'Array of blockchain chain IDs where contracts exist';
COMMENT ON COLUMN discount_codes.required_balance IS 'Minimum token/NFT balance required for eligibility';
COMMENT ON COLUMN discount_codes.whitelisted_wallets IS 'Array of wallet addresses eligible for this discount';
COMMENT ON COLUMN discount_codes.whitelisted_fids IS 'Array of FIDs eligible for this discount';
COMMENT ON COLUMN discount_codes.whitelist_snapshot_date IS 'Date for snapshot-based token requirements';
COMMENT ON COLUMN discount_codes.max_uses_total IS 'Maximum total uses of this discount across all users';
COMMENT ON COLUMN discount_codes.max_uses_per_user IS 'Maximum uses per individual user';
COMMENT ON COLUMN discount_codes.auto_apply IS 'Whether to automatically apply this discount if user is eligible';
COMMENT ON COLUMN discount_codes.stackable_with_other_discounts IS 'Whether this discount can be combined with others';
COMMENT ON COLUMN discount_codes.priority_level IS 'Priority for discount conflict resolution (higher wins)';
COMMENT ON COLUMN discount_codes.campaign_id IS 'Campaign identifier for grouping related discounts';

-- Create a table for tracking discount eligibility checks (for performance and debugging)
CREATE TABLE IF NOT EXISTS discount_eligibility_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  fid INTEGER NOT NULL,
  wallet_address TEXT,
  
  -- Check results
  is_eligible BOOLEAN NOT NULL,
  eligibility_reason TEXT, -- Why eligible/not eligible
  token_balance_found DECIMAL(20,8), -- Actual balance found during check
  contracts_checked JSONB, -- Which contracts were checked
  
  -- Performance tracking
  check_duration_ms INTEGER, -- How long the check took
  blockchain_calls_made INTEGER DEFAULT 0, -- Number of blockchain calls
  
  -- Metadata
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for eligibility checks table
CREATE INDEX IF NOT EXISTS idx_eligibility_checks_discount_code_id ON discount_eligibility_checks(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_checks_fid ON discount_eligibility_checks(fid);
CREATE INDEX IF NOT EXISTS idx_eligibility_checks_wallet_address ON discount_eligibility_checks(wallet_address);
CREATE INDEX IF NOT EXISTS idx_eligibility_checks_is_eligible ON discount_eligibility_checks(is_eligible);
CREATE INDEX IF NOT EXISTS idx_eligibility_checks_created_at ON discount_eligibility_checks(created_at);

-- Enable RLS for the new table
ALTER TABLE discount_eligibility_checks ENABLE ROW LEVEL SECURITY;

-- Create policy for eligibility checks
CREATE POLICY "Allow all operations on eligibility checks for now" ON discount_eligibility_checks
  FOR ALL USING (true);

-- Trigger to update updated_at for eligibility checks
CREATE TRIGGER update_discount_eligibility_checks_updated_at 
  BEFORE UPDATE ON discount_eligibility_checks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column(); 