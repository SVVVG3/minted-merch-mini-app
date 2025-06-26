-- Minted Merch Mini App Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS notification_tokens;
DROP TABLE IF EXISTS profiles;

-- Profiles table for storing Farcaster user information
-- Simplified - no notification token storage (managed by Neynar)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,
  username TEXT,
  display_name TEXT,
  bio TEXT,
  pfp_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_fid ON profiles(fid);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles table
-- Allow all operations for now (you can restrict this later based on your needs)
CREATE POLICY "Allow all operations on profiles" ON profiles
  FOR ALL USING (true);

-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at when a row is modified
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column(); 