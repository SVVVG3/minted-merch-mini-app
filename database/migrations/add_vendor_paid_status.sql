-- Migration: Add 'vendor_paid' status to orders table
-- Date: 2025-01-19
-- Description: Add vendor_paid status for tracking when partners have been paid

-- Drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint with 'vendor_paid' status
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'paid', 'processing', 'assigned', 'shipped', 'vendor_paid', 'delivered', 'cancelled', 'refunded'));

-- Add an index on status for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status ON orders (status); 