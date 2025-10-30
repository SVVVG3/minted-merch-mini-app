-- Migration: Add discount code usage tracking for shared codes
-- Date: January 2025
-- Purpose: Enable proper tracking of discount code usage per user for shared codes

-- Create discount_code_usage table for tracking per-user usage
CREATE TABLE IF NOT EXISTS discount_code_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  fid INTEGER NOT NULL REFERENCES profiles(fid) ON DELETE CASCADE,
  
  -- Usage details
  order_id TEXT NOT NULL, -- Reference to the order where this code was used
  discount_amount DECIMAL(10,2) NOT NULL, -- Amount discounted for this usage
  original_subtotal DECIMAL(10,2), -- Original order subtotal before discount
  
  -- Metadata
  ip_address INET, -- IP address for fraud detection
  user_agent TEXT, -- User agent for analytics
  
  -- Timestamps
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_code_usage UNIQUE(discount_code_id, fid) -- One use per user per code
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_discount_code_id ON discount_code_usage(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_fid ON discount_code_usage(fid);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_order_id ON discount_code_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_used_at ON discount_code_usage(used_at);

-- Enable Row Level Security
ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for discount_code_usage table
CREATE POLICY "Users can view their own discount usage" ON discount_code_usage
  FOR SELECT USING (fid = (SELECT fid FROM profiles WHERE fid = discount_code_usage.fid));

CREATE POLICY "Allow all operations on discount_code_usage for now" ON discount_code_usage
  FOR ALL USING (true);

-- Trigger to update updated_at (if we add it later)
-- Note: We don't have updated_at on this table since usage records shouldn't change

-- Add a function to check if a user has used a specific discount code
CREATE OR REPLACE FUNCTION has_user_used_discount_code(
  p_discount_code_id UUID,
  p_fid INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM discount_code_usage 
    WHERE discount_code_id = p_discount_code_id 
    AND fid = p_fid
  );
END;
$$ LANGUAGE plpgsql;

-- Add a function to get user usage count for a discount code
CREATE OR REPLACE FUNCTION get_user_discount_usage_count(
  p_discount_code_id UUID,
  p_fid INTEGER
) RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM discount_code_usage 
    WHERE discount_code_id = p_discount_code_id 
    AND fid = p_fid
  );
END;
$$ LANGUAGE plpgsql;

-- Add a function to get total usage count for a discount code
CREATE OR REPLACE FUNCTION get_discount_total_usage_count(
  p_discount_code_id UUID
) RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM discount_code_usage 
    WHERE discount_code_id = p_discount_code_id
  );
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE discount_code_usage IS 'Tracks individual usage of discount codes by users, enabling shared codes with per-user limits';
COMMENT ON COLUMN discount_code_usage.discount_code_id IS 'Reference to the discount code that was used';
COMMENT ON COLUMN discount_code_usage.fid IS 'FID of the user who used the code';
COMMENT ON COLUMN discount_code_usage.order_id IS 'Order ID where this discount was applied';
COMMENT ON COLUMN discount_code_usage.discount_amount IS 'Actual discount amount applied to the order';
COMMENT ON COLUMN discount_code_usage.original_subtotal IS 'Original order subtotal before discount was applied';

-- Update the discount_codes table to support shared codes
-- Remove the fid requirement for shared codes by making it nullable
ALTER TABLE discount_codes ALTER COLUMN fid DROP NOT NULL;

-- Add a column to indicate if this is a shared code
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS is_shared_code BOOLEAN DEFAULT FALSE;

-- Add index for shared code queries
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_shared_code ON discount_codes(is_shared_code);

-- Add comment
COMMENT ON COLUMN discount_codes.is_shared_code IS 'Whether this code can be used by multiple users (true) or is user-specific (false)';
COMMENT ON COLUMN discount_codes.fid IS 'FID of code owner (for user-specific codes) or NULL for shared codes';

-- Note: We keep the existing is_used field for backward compatibility with user-specific codes
-- For shared codes, we'll rely on the usage tracking table instead 