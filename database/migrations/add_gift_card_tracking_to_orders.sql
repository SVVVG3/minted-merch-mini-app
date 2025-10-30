-- Add gift card tracking columns to orders table
-- This migration adds support for tracking gift card usage in orders

-- Add gift card tracking columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_codes TEXT[] DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_total_used DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_count INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_gift_card_codes ON orders USING GIN(gift_card_codes);
CREATE INDEX IF NOT EXISTS idx_orders_gift_card_total_used ON orders(gift_card_total_used);
CREATE INDEX IF NOT EXISTS idx_orders_gift_card_count ON orders(gift_card_count);

-- Add comments for documentation
COMMENT ON COLUMN orders.gift_card_codes IS 'Array of gift card codes used in this order';
COMMENT ON COLUMN orders.gift_card_total_used IS 'Total amount used from gift cards for this order';
COMMENT ON COLUMN orders.gift_card_count IS 'Number of gift cards used in this order'; 