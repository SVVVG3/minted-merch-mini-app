-- Add support for Base app notifications (separate from Farcaster/Neynar)
-- Base app and Farcaster/Warpcast use different notification systems

-- Add column to profiles to track Base app notification status separately
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_base_notifications BOOLEAN DEFAULT FALSE;

-- Create table to store Base app notification tokens
CREATE TABLE IF NOT EXISTS base_app_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid BIGINT NOT NULL UNIQUE,
  notification_url TEXT NOT NULL,
  notification_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key to profiles
  CONSTRAINT fk_base_app_tokens_profile 
    FOREIGN KEY (fid) 
    REFERENCES profiles(fid) 
    ON DELETE CASCADE
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_base_app_tokens_fid 
  ON base_app_notification_tokens(fid);

-- Enable RLS
ALTER TABLE base_app_notification_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for base_app_notification_tokens

-- Allow service role full access (for admin operations)
CREATE POLICY "Service role has full access to base app tokens"
  ON base_app_notification_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view their own tokens
CREATE POLICY "Users can view their own base app tokens"
  ON base_app_notification_tokens
  FOR SELECT
  TO authenticated
  USING (fid = (current_setting('app.user_fid', true))::bigint);

-- Comment on table and columns
COMMENT ON TABLE base_app_notification_tokens IS 
  'Stores notification tokens for Base app (separate from Farcaster/Neynar managed tokens)';
COMMENT ON COLUMN base_app_notification_tokens.fid IS 
  'User Farcaster ID';
COMMENT ON COLUMN base_app_notification_tokens.notification_url IS 
  'Base app notification API URL (e.g., https://api.farcaster.xyz/v1/frame-notifications)';
COMMENT ON COLUMN base_app_notification_tokens.notification_token IS 
  'Base app notification token - unique per (Farcaster Client, Mini App, user FID) tuple';
COMMENT ON COLUMN profiles.has_base_notifications IS 
  'Whether user has enabled notifications in the Base app (separate from has_notifications which tracks Farcaster/Warpcast)';

