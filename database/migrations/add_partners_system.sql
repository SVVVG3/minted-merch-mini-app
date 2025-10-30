-- Add Partners System Migration
-- This adds partner management and order assignment capabilities

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  fid INTEGER REFERENCES profiles(fid) ON DELETE SET NULL, -- Linked Farcaster ID for notifications
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for partners table
CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);
CREATE INDEX IF NOT EXISTS idx_partners_fid ON partners(fid);
CREATE INDEX IF NOT EXISTS idx_partners_is_active ON partners(is_active);

-- Enable RLS for partners
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Create policies for partners table
CREATE POLICY "Allow all operations on partners for admins" ON partners
  FOR ALL USING (true); -- Admin access only

-- Trigger to update updated_at for partners
CREATE TRIGGER update_partners_updated_at 
  BEFORE UPDATE ON partners 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add partner assignment fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Update order status to include 'assigned'
-- First, drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint with 'assigned' status
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'paid', 'processing', 'assigned', 'shipped', 'delivered', 'cancelled', 'refunded'));

-- Create index for partner assignment lookups
CREATE INDEX IF NOT EXISTS idx_orders_assigned_partner_id ON orders(assigned_partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_at ON orders(assigned_at);

-- Add comments for documentation
COMMENT ON TABLE partners IS 'Partners who can fulfill orders - linked to Farcaster profiles for notifications';
COMMENT ON COLUMN orders.assigned_partner_id IS 'Partner assigned to fulfill this order';
COMMENT ON COLUMN orders.assigned_at IS 'When this order was assigned to a partner'; 