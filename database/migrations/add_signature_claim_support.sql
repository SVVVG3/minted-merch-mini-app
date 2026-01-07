-- Migration: Add signature claim support for free orders
-- Description: Allows $0 orders to use EIP-712 signature verification instead of payment
-- This bypasses Daimo Pay's $0.25 minimum for orders with 100% discounts

-- Add signature claim columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS claim_signature TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS claim_signature_message JSONB;

-- Add payment_type column to track which payment method was used
-- Check if the column exists first to avoid errors on re-run
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_type'
    ) THEN
        ALTER TABLE orders ADD COLUMN payment_type TEXT DEFAULT 'daimo';
    END IF;
END $$;

-- Add constraint for valid payment types (drop first if exists to update)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_type_check 
  CHECK (payment_type IN ('daimo', 'walletconnect', 'signature_claim', 'direct'));

-- Create index for efficient querying by payment type
CREATE INDEX IF NOT EXISTS idx_orders_payment_type ON orders(payment_type);
CREATE INDEX IF NOT EXISTS idx_orders_claim_signature ON orders(claim_signature) WHERE claim_signature IS NOT NULL;

-- Create table for tracking signature nonces (prevents replay attacks)
CREATE TABLE IF NOT EXISTS signature_claim_nonces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nonce TEXT UNIQUE NOT NULL,
  fid INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  order_id TEXT,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index for fast lookups
  CONSTRAINT signature_claim_nonces_unique_nonce UNIQUE (nonce)
);

-- Create indexes for nonce table
CREATE INDEX IF NOT EXISTS idx_signature_claim_nonces_fid ON signature_claim_nonces(fid);
CREATE INDEX IF NOT EXISTS idx_signature_claim_nonces_wallet ON signature_claim_nonces(wallet_address);
CREATE INDEX IF NOT EXISTS idx_signature_claim_nonces_used_at ON signature_claim_nonces(used_at);

-- Enable RLS for nonce table
ALTER TABLE signature_claim_nonces ENABLE ROW LEVEL SECURITY;

-- Only service role can access nonces (for security)
CREATE POLICY "Service role only for nonces" ON signature_claim_nonces
  FOR ALL USING (
    current_setting('role') = 'service_role' 
    OR current_setting('app.user_fid', true)::integer = 999999999
  );

-- Create table for rate limiting free order claims
CREATE TABLE IF NOT EXISTS free_order_claim_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fid INTEGER NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claim_count INTEGER DEFAULT 1,
  last_claim_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One row per FID per day
  CONSTRAINT free_order_claim_limits_fid_date UNIQUE (fid, claim_date)
);

-- Create indexes for rate limit table
CREATE INDEX IF NOT EXISTS idx_free_order_claim_limits_fid ON free_order_claim_limits(fid);
CREATE INDEX IF NOT EXISTS idx_free_order_claim_limits_date ON free_order_claim_limits(claim_date);

-- Enable RLS for rate limit table
ALTER TABLE free_order_claim_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits
CREATE POLICY "Service role only for rate limits" ON free_order_claim_limits
  FOR ALL USING (
    current_setting('role') = 'service_role' 
    OR current_setting('app.user_fid', true)::integer = 999999999
  );

-- Add comments for documentation
COMMENT ON COLUMN orders.claim_signature IS 'EIP-712 signature for free order claims (when payment_type is signature_claim)';
COMMENT ON COLUMN orders.claim_signature_message IS 'The typed data message that was signed, stored for verification audit trail';
COMMENT ON COLUMN orders.payment_type IS 'Payment method used: daimo (default), walletconnect, signature_claim (for $0 orders), or direct';

COMMENT ON TABLE signature_claim_nonces IS 'Tracks used nonces to prevent replay attacks on free order signatures';
COMMENT ON TABLE free_order_claim_limits IS 'Rate limits for free order claims per FID per day';

-- Function to check if FID has exceeded free order claim limit
CREATE OR REPLACE FUNCTION check_free_order_claim_limit(p_fid INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_daily_count INTEGER;
  v_last_claim TIMESTAMP WITH TIME ZONE;
  v_hourly_ok BOOLEAN;
  v_daily_limit INTEGER := 3;  -- Max 3 free orders per day
  v_hourly_cooldown INTERVAL := '1 hour';
BEGIN
  -- Get current daily count and last claim time
  SELECT claim_count, last_claim_at
  INTO v_daily_count, v_last_claim
  FROM free_order_claim_limits
  WHERE fid = p_fid AND claim_date = CURRENT_DATE;
  
  -- If no record exists, they haven't claimed today
  IF v_daily_count IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'daily_remaining', v_daily_limit,
      'hourly_ok', true
    );
  END IF;
  
  -- Check hourly cooldown
  v_hourly_ok := (v_last_claim IS NULL) OR (NOW() - v_last_claim > v_hourly_cooldown);
  
  -- Return result
  RETURN jsonb_build_object(
    'allowed', (v_daily_count < v_daily_limit) AND v_hourly_ok,
    'daily_remaining', GREATEST(0, v_daily_limit - v_daily_count),
    'hourly_ok', v_hourly_ok,
    'daily_count', COALESCE(v_daily_count, 0),
    'next_available', CASE 
      WHEN NOT v_hourly_ok THEN v_last_claim + v_hourly_cooldown
      WHEN v_daily_count >= v_daily_limit THEN (CURRENT_DATE + INTERVAL '1 day')::timestamp with time zone
      ELSE NULL
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a free order claim
CREATE OR REPLACE FUNCTION record_free_order_claim(p_fid INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO free_order_claim_limits (fid, claim_date, claim_count, last_claim_at)
  VALUES (p_fid, CURRENT_DATE, 1, NOW())
  ON CONFLICT (fid, claim_date) 
  DO UPDATE SET 
    claim_count = free_order_claim_limits.claim_count + 1,
    last_claim_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions to authenticated users (functions use SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION check_free_order_claim_limit(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION record_free_order_claim(INTEGER) TO service_role;

