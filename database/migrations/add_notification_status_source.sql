-- Migration: Add notification status source tracking to profiles table
-- Date: January 2025
-- Purpose: Track the source of notification status updates (realtime events vs cron sync)

-- Add notification_status_source column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_status_source TEXT DEFAULT 'unknown';

-- Create index for source tracking queries
CREATE INDEX IF NOT EXISTS idx_profiles_notification_status_source ON profiles(notification_status_source);

-- Add comment for documentation
COMMENT ON COLUMN profiles.notification_status_source IS 'Source of the notification status update: farcaster_event, miniapp_removed, cron_sync, manual, etc.';

-- Update existing records to mark them as cron_sync since they came from the existing cron system
UPDATE profiles 
SET notification_status_source = 'cron_sync' 
WHERE notification_status_updated_at IS NOT NULL 
  AND notification_status_source = 'unknown'; 