-- Migration: Add vendor_payout_partner_notes field to orders table
-- Date: 2025-12-13
-- Description: Separate internal notes (admin only) from partner-visible notes

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS vendor_payout_partner_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN orders.vendor_payout_partner_notes IS 'Notes about the payout that are visible to the partner (e.g., payment confirmation message)';
COMMENT ON COLUMN orders.vendor_payout_notes IS 'Internal admin notes about the payout (not visible to partners)';

