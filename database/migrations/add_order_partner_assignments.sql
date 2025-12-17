-- Migration: Add order_partner_assignments table for multi-partner order support
-- This allows orders to be assigned to multiple partners with individual tracking and payout info

-- Create the order_partner_assignments table
CREATE TABLE IF NOT EXISTS order_partner_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  
  -- Assignment status (independent of order status)
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'shipped', 'vendor_paid')),
  
  -- Timestamps
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  vendor_paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Shipping/tracking info (for fulfillment partners)
  tracking_number TEXT,
  tracking_url TEXT,
  carrier TEXT,
  
  -- Payout info (separate for each partner)
  vendor_payout_amount DECIMAL(10, 2),
  vendor_payout_internal_notes TEXT,
  vendor_payout_partner_notes TEXT,
  
  -- Notes about what items this partner is responsible for
  assignment_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate assignments
  UNIQUE(order_id, partner_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_order_partner_assignments_order_id ON order_partner_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_partner_assignments_partner_id ON order_partner_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_order_partner_assignments_status ON order_partner_assignments(status);

-- Enable RLS
ALTER TABLE order_partner_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin full access to order_partner_assignments"
  ON order_partner_assignments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_partner_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_partner_assignments_updated_at_trigger
  BEFORE UPDATE ON order_partner_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_partner_assignments_updated_at();

-- Migrate existing assignments from orders table to new table
-- This preserves existing single-partner assignments
INSERT INTO order_partner_assignments (
  order_id,
  partner_id,
  status,
  assigned_at,
  shipped_at,
  vendor_paid_at,
  tracking_number,
  tracking_url,
  carrier,
  vendor_payout_amount,
  vendor_payout_internal_notes,
  vendor_payout_partner_notes
)
SELECT 
  o.order_id,
  o.assigned_partner_id,
  CASE 
    WHEN o.status = 'vendor_paid' THEN 'vendor_paid'
    WHEN o.status = 'shipped' THEN 'shipped'
    ELSE 'assigned'
  END,
  o.assigned_at,
  o.shipped_at,
  o.vendor_paid_at,
  o.tracking_number,
  o.tracking_url,
  o.carrier,
  o.vendor_payout_amount,
  o.vendor_payout_notes,
  o.vendor_payout_partner_notes
FROM orders o
WHERE o.assigned_partner_id IS NOT NULL
ON CONFLICT (order_id, partner_id) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE order_partner_assignments IS 'Links orders to multiple partners with individual tracking and payout info for each partner assignment';

