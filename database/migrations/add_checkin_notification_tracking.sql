-- Migration: Add check-in notification tracking to profiles table
-- Date: November 2, 2025
-- Purpose: Prevent duplicate daily/evening check-in reminder notifications

-- Add columns to track when check-in reminder notifications were last sent
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_daily_reminder_sent_date DATE,
ADD COLUMN IF NOT EXISTS last_evening_reminder_sent_date DATE;

-- Create indexes for better performance when filtering users
CREATE INDEX IF NOT EXISTS idx_profiles_last_daily_reminder 
  ON profiles(last_daily_reminder_sent_date);

CREATE INDEX IF NOT EXISTS idx_profiles_last_evening_reminder 
  ON profiles(last_evening_reminder_sent_date);

-- Add comments for documentation
COMMENT ON COLUMN profiles.last_daily_reminder_sent_date IS 
  'Date (in PST) when the last daily check-in reminder (8 AM) was sent to this user';

COMMENT ON COLUMN profiles.last_evening_reminder_sent_date IS 
  'Date (in PST) when the last evening check-in reminder (8 PM) was sent to this user';

