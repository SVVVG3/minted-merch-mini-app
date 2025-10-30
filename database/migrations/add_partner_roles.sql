-- Add Partner Roles Migration
-- Adds partner_type to differentiate between fulfillment and collab partners

-- Add partner_type column to partners table
ALTER TABLE partners 
  ADD COLUMN IF NOT EXISTS partner_type TEXT NOT NULL DEFAULT 'fulfillment'
  CHECK (partner_type IN ('fulfillment', 'collab'));

-- Create index for partner type filtering
CREATE INDEX IF NOT EXISTS idx_partners_partner_type ON partners(partner_type);

-- Add comments for documentation
COMMENT ON COLUMN partners.partner_type IS 'Type of partner: fulfillment (sees shipping info) or collab (sees Farcaster info)';

