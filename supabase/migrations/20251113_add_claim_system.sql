-- Migration: Add Self-Service Claim System
-- Date: Nov 13, 2025
-- Description: Add signature-based claim fields and tracking tables

-- =====================================================
-- 1. Add claim fields to ambassador_payouts table
-- =====================================================
ALTER TABLE ambassador_payouts
ADD COLUMN IF NOT EXISTS claim_signature TEXT,
ADD COLUMN IF NOT EXISTS claim_deadline TIMESTAMP,
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS claim_transaction_hash TEXT;

-- Update status constraint to include 'claimable'
ALTER TABLE ambassador_payouts 
DROP CONSTRAINT IF EXISTS ambassador_payouts_status_check;

ALTER TABLE ambassador_payouts 
ADD CONSTRAINT ambassador_payouts_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'claimable'::text, 'processing'::text, 'completed'::text, 'failed'::text]));

-- Add index for efficient claim lookups
CREATE INDEX IF NOT EXISTS idx_payouts_claimable 
ON ambassador_payouts(status, claim_signature) 
WHERE status = 'claimable';

-- =====================================================
-- 2. Create payout_claim_events table for audit trail
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_claim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES ambassador_payouts(id) ON DELETE CASCADE,
  user_fid TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  signature_used TEXT,
  transaction_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('data_accessed', 'claim_initiated', 'success', 'failed', 'rejected')),
  error_message TEXT,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. Enable RLS on payout_claim_events
-- =====================================================
ALTER TABLE payout_claim_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. Create RLS policies
-- =====================================================

-- Policy: Ambassadors can view their own payout claim events
CREATE POLICY IF NOT EXISTS "Ambassadors can view own claim events"
ON payout_claim_events FOR SELECT
USING (user_fid = (auth.jwt() ->> 'fid'));

-- Policy: Only service role can insert claim events
CREATE POLICY IF NOT EXISTS "Only backend writes claim events"
ON payout_claim_events FOR INSERT
WITH CHECK (false); -- Only service role can insert

-- =====================================================
-- 5. Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_claim_events_payout 
ON payout_claim_events(payout_id);

CREATE INDEX IF NOT EXISTS idx_claim_events_user 
ON payout_claim_events(user_fid);

CREATE INDEX IF NOT EXISTS idx_claim_events_status 
ON payout_claim_events(status, created_at DESC);

-- =====================================================
-- 6. Add comment documentation
-- =====================================================
COMMENT ON TABLE payout_claim_events IS 'Audit trail for all payout claim attempts and events';
COMMENT ON COLUMN ambassador_payouts.claim_signature IS 'Cryptographic signature for self-service claim';
COMMENT ON COLUMN ambassador_payouts.claim_deadline IS 'Expiration time for claim signature (typically 30 days)';
COMMENT ON COLUMN ambassador_payouts.claimed_at IS 'Timestamp when payout was claimed by ambassador';
COMMENT ON COLUMN ambassador_payouts.claim_transaction_hash IS 'Base blockchain transaction hash of the claim';

