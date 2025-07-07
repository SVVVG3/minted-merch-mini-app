-- Migration: Add free shipping capability to discount codes
-- Date: January 2025
-- Purpose: Enable discount codes to provide free shipping for giveaways and promotions

-- Add free_shipping column to discount_codes table
ALTER TABLE discount_codes 
ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN DEFAULT FALSE;

-- Add index for free shipping queries
CREATE INDEX IF NOT EXISTS idx_discount_codes_free_shipping ON discount_codes(free_shipping);

-- Add comment for documentation
COMMENT ON COLUMN discount_codes.free_shipping IS 'Whether this discount code provides free shipping (true) or not (false)';

-- Update existing discount codes to explicitly set free_shipping to false if not specified
UPDATE discount_codes 
SET free_shipping = FALSE 
WHERE free_shipping IS NULL; 