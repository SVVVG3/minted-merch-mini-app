-- Create chat_invitations table for tracking invitation generation and usage
CREATE TABLE IF NOT EXISTS chat_invitations (
  id SERIAL PRIMARY KEY,
  fid INTEGER NOT NULL,
  invitation_token TEXT UNIQUE NOT NULL,
  group_link TEXT NOT NULL,
  token_balance DECIMAL(20, 6) DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  clicked BOOLEAN DEFAULT false,
  clicked_at TIMESTAMP WITH TIME ZONE,
  joined BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE,
  
  -- Foreign key to chat_members if they exist
  FOREIGN KEY (fid) REFERENCES chat_members(fid) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_invitations_fid ON chat_invitations(fid);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_token ON chat_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_generated_at ON chat_invitations(generated_at);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_clicked ON chat_invitations(clicked);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_joined ON chat_invitations(joined);

-- Add comments
COMMENT ON TABLE chat_invitations IS 'Tracks invitation generation and usage for the token-gated chat';
COMMENT ON COLUMN chat_invitations.fid IS 'Farcaster ID of the user who received the invitation';
COMMENT ON COLUMN chat_invitations.invitation_token IS 'Unique invitation token for tracking';
COMMENT ON COLUMN chat_invitations.group_link IS 'The Farcaster group link provided';
COMMENT ON COLUMN chat_invitations.token_balance IS 'Token balance at time of invitation generation';
COMMENT ON COLUMN chat_invitations.clicked IS 'Whether the invitation link was clicked';
COMMENT ON COLUMN chat_invitations.joined IS 'Whether the user actually joined the group';
