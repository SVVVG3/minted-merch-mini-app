-- Create chat_members table for token-gated chat management
CREATE TABLE IF NOT EXISTS chat_members (
  id SERIAL PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,
  username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  wallet_addresses JSONB DEFAULT '[]'::jsonb,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  removed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  -- Indexes for performance
  CONSTRAINT unique_active_fid UNIQUE (fid)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_members_fid ON chat_members(fid);
CREATE INDEX IF NOT EXISTS idx_chat_members_active ON chat_members(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_members_added_at ON chat_members(added_at);

-- Add comments
COMMENT ON TABLE chat_members IS 'Members of the token-gated $MINTEDMERCH holders chat';
COMMENT ON COLUMN chat_members.fid IS 'Farcaster ID of the user';
COMMENT ON COLUMN chat_members.wallet_addresses IS 'JSON array of Ethereum wallet addresses';
COMMENT ON COLUMN chat_members.is_active IS 'Whether the member is currently active in the chat';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_chat_members_updated_at
  BEFORE UPDATE ON chat_members
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_members_updated_at();
