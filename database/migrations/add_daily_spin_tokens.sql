-- Add Daily Spin Tokens System Migration
-- Adds token configuration and user winnings tracking for daily spin wheel
-- Created: December 27, 2024

-- ============================================================================
-- TABLE 1: spin_tokens
-- ============================================================================
-- Stores token configuration for the daily spin wheel

CREATE TABLE IF NOT EXISTS spin_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  decimals INTEGER DEFAULT 18,
  probability_weight INTEGER DEFAULT 15,  -- 40 for mintedmerch, 15 for others (total 100)
  is_active BOOLEAN DEFAULT true,
  segment_color TEXT NOT NULL,            -- Hex color for wheel segment
  logo_url TEXT,                          -- Optional token logo URL
  shop_url TEXT,                          -- Optional: URL to collection/product page in shop
  dexscreener_url TEXT,                   -- Optional: custom DexScreener link for token
  dexscreener_pair TEXT,                  -- Optional: specific pair address for price lookup
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for spin_tokens table
CREATE INDEX IF NOT EXISTS idx_spin_tokens_symbol ON spin_tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_spin_tokens_is_active ON spin_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_spin_tokens_contract ON spin_tokens(contract_address);

-- Enable RLS for spin_tokens
ALTER TABLE spin_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for spin_tokens (public read, admin write)
CREATE POLICY "Anyone can view active tokens" ON spin_tokens
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage tokens" ON spin_tokens
  FOR ALL USING (true);

-- Trigger to update updated_at for spin_tokens
CREATE OR REPLACE FUNCTION update_spin_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_spin_tokens_updated_at 
  BEFORE UPDATE ON spin_tokens 
  FOR EACH ROW 
  EXECUTE FUNCTION update_spin_tokens_updated_at();

-- Comments for documentation
COMMENT ON TABLE spin_tokens IS 'Token configuration for daily spin wheel rewards';
COMMENT ON COLUMN spin_tokens.probability_weight IS 'Weight for random selection (higher = more likely)';
COMMENT ON COLUMN spin_tokens.segment_color IS 'Hex color code for wheel segment display';
COMMENT ON COLUMN spin_tokens.dexscreener_pair IS 'Optional DexScreener pair address for price lookup';

-- ============================================================================
-- SEED DATA: Initial tokens
-- ============================================================================
-- $mintedmerch: 25% weight
-- $BETR, $VEIL, $BNKR, $CLANKER: 15% each
-- MISS (no win): 15%

INSERT INTO spin_tokens (symbol, name, contract_address, probability_weight, segment_color, decimals) VALUES
('mintedmerch', 'Minted Merch', '0x774EAeFE73Df7959496Ac92a77279A8D7d690b07', 25, '#3eb489', 18),
('BETR', 'BETR', '0x051024B653E8ec69E72693F776c41C2A9401FB07', 15, '#f97316', 18),
('VEIL', 'VEIL', '0x767A739D1A152639e9Ea1D8c1BD55FDC5B217D7f', 15, '#8b5cf6', 18),
('BNKR', 'BNKR', '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b', 15, '#ef4444', 18),
('CLANKER', 'CLANKER', '0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb', 15, '#3b82f6', 18),
('MISS', 'Better Luck Next Time!', '0x0000000000000000000000000000000000000000', 15, '#6b7280', 0)
ON CONFLICT (symbol) DO UPDATE SET
  contract_address = EXCLUDED.contract_address,
  probability_weight = EXCLUDED.probability_weight,
  segment_color = EXCLUDED.segment_color,
  is_active = true,
  updated_at = NOW();

-- ============================================================================
-- TABLE 2: spin_winnings
-- ============================================================================
-- Tracks user winnings from daily spins (pending and claimed)

CREATE TABLE IF NOT EXISTS spin_winnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_fid INTEGER NOT NULL,
  token_id UUID NOT NULL REFERENCES spin_tokens(id) ON DELETE CASCADE,
  amount TEXT NOT NULL,                   -- Token amount as string (for BigInt precision)
  usd_value DECIMAL(10,4) DEFAULT 0.01,   -- USD value at time of spin
  token_price DECIMAL(20,10),             -- Token price at time of spin
  spin_date DATE NOT NULL,                -- Date of spin (for daily tracking)
  claimed BOOLEAN DEFAULT false,
  claim_tx_hash TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key to profiles
  CONSTRAINT fk_spin_winnings_user FOREIGN KEY (user_fid) REFERENCES profiles(fid) ON DELETE CASCADE
);

-- Indexes for spin_winnings table
CREATE INDEX IF NOT EXISTS idx_spin_winnings_user_fid ON spin_winnings(user_fid);
CREATE INDEX IF NOT EXISTS idx_spin_winnings_spin_date ON spin_winnings(spin_date);
CREATE INDEX IF NOT EXISTS idx_spin_winnings_user_date ON spin_winnings(user_fid, spin_date);
CREATE INDEX IF NOT EXISTS idx_spin_winnings_unclaimed ON spin_winnings(user_fid, claimed) WHERE claimed = false;
CREATE INDEX IF NOT EXISTS idx_spin_winnings_token ON spin_winnings(token_id);
CREATE INDEX IF NOT EXISTS idx_spin_winnings_claim_tx ON spin_winnings(claim_tx_hash) WHERE claim_tx_hash IS NOT NULL;

-- Enable RLS for spin_winnings
ALTER TABLE spin_winnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for spin_winnings
-- Users can only view their own winnings
CREATE POLICY "Users can view their own winnings" ON spin_winnings
  FOR SELECT USING (user_fid = current_setting('app.current_fid', true)::integer);

-- Service role can manage all winnings (for API routes)
CREATE POLICY "Service role can manage winnings" ON spin_winnings
  FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE spin_winnings IS 'User winnings from daily spin wheel - tracks pending and claimed rewards';
COMMENT ON COLUMN spin_winnings.amount IS 'Token amount as string to preserve BigInt precision';
COMMENT ON COLUMN spin_winnings.usd_value IS 'USD value at time of spin (approximately $0.01)';
COMMENT ON COLUMN spin_winnings.token_price IS 'Token price in USD at time of spin';
COMMENT ON COLUMN spin_winnings.spin_date IS 'Date of spin for daily tracking and limits';
COMMENT ON COLUMN spin_winnings.claimed IS 'Whether tokens have been claimed on-chain';
COMMENT ON COLUMN spin_winnings.claim_tx_hash IS 'Transaction hash of successful claim';

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================
-- Run these after migration to verify:
-- SELECT * FROM spin_tokens ORDER BY probability_weight DESC;
-- SELECT symbol, probability_weight, segment_color FROM spin_tokens WHERE is_active = true;

