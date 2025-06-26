-- Minted Merch Mini App Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS notification_tokens;
DROP TABLE IF EXISTS profiles;

-- Single profiles table with notification support
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  pfp_url TEXT,
  
  -- Notification fields
  notifications_enabled BOOLEAN DEFAULT FALSE,
  notification_token TEXT,
  notification_url TEXT DEFAULT 'https://api.farcaster.xyz/v1/frame-notifications',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_profiles_fid ON profiles(fid);
CREATE INDEX idx_profiles_notifications ON profiles(notifications_enabled) WHERE notifications_enabled = TRUE;

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations for now (using anon key)
CREATE POLICY "Allow all access to profiles" ON profiles
  FOR ALL USING (true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column(); 