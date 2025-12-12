-- Migration: Add vendor payout tracking to orders table
-- Date: 2025-12-12
-- Description: Track payout amounts when orders are marked as vendor_paid

-- Add vendor payout tracking fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS vendor_payout_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vendor_paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS vendor_payout_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN orders.vendor_payout_amount IS 'Amount paid to the fulfillment partner/vendor for this order';
COMMENT ON COLUMN orders.vendor_paid_at IS 'When the vendor was paid for this order';
COMMENT ON COLUMN orders.vendor_payout_notes IS 'Optional notes about the vendor payout (payment reference, invoice #, etc.)';

