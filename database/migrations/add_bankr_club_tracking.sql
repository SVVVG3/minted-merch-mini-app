-- Migration: Add Bankr Club membership tracking to profiles table
-- Date: January 2025
-- Purpose: Store user Bankr Club membership status and X username for token gating

-- Add Bankr Club columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bankr_club_member BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS x_username TEXT,
ADD COLUMN IF NOT EXISTS bankr_membership_updated_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_bankr_club_member ON profiles(bankr_club_member);
CREATE INDEX IF NOT EXISTS idx_profiles_x_username ON profiles(x_username);
CREATE INDEX IF NOT EXISTS idx_profiles_bankr_membership_updated_at ON profiles(bankr_membership_updated_at);

-- Add comments to document the purpose of each field
COMMENT ON COLUMN profiles.bankr_club_member IS 'Whether this user is a member of Bankr Club (verified via Bankr API)';
COMMENT ON COLUMN profiles.x_username IS 'User X/Twitter username for Bankr Club verification';
COMMENT ON COLUMN profiles.bankr_membership_updated_at IS 'Last time Bankr Club membership status was checked via API'; 