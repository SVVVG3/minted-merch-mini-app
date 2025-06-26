-- Minted Merch Database Schema
-- This schema is based on the working GameLink implementation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table for storing Farcaster user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  pfp_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification tokens table for storing user notification permissions
CREATE TABLE IF NOT EXISTS notification_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL REFERENCES profiles(fid) ON DELETE CASCADE,
  token TEXT NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_fid ON profiles(fid);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_fid ON notification_tokens(fid);
CREATE INDEX IF NOT EXISTS idx_notification_tokens_active ON notification_tokens(is_active);

-- Row Level Security (RLS) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_tokens ENABLE ROW LEVEL SECURITY;

-- Allow public read access to profiles (for discovery)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

-- Allow users to insert/update their own profile
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (true);

-- Notification tokens should only be accessible by the system
CREATE POLICY "Only system can access notification tokens" ON notification_tokens
  FOR ALL USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_tokens_updated_at BEFORE UPDATE ON notification_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 