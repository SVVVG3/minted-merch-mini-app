-- Migration: Add notification status tracking to profiles table
-- Date: December 2024
-- Purpose: Track user notification status to solve issues like madyak's case

-- Add has_notifications column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_notifications BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_status_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_has_notifications ON profiles(has_notifications);

-- Update existing users who have received notifications to mark them as having notifications
-- This will help with users like madyak who clearly have notifications but aren't tracked properly
UPDATE profiles 
SET has_notifications = true, 
    notification_status_updated_at = NOW()
WHERE welcome_notification_sent = true 
   OR id IN (
     SELECT DISTINCT p.id 
     FROM profiles p 
     INNER JOIN orders o ON p.fid = o.fid 
     WHERE o.shipping_notification_sent = true
   );

-- Also update users who have received shipping notifications
-- (They must have notifications enabled to receive shipping updates)
UPDATE profiles 
SET has_notifications = true,
    notification_status_updated_at = NOW()
WHERE fid IN (
  SELECT DISTINCT fid 
  FROM orders 
  WHERE shipping_notification_sent = true
);

-- Add comment to document the purpose
COMMENT ON COLUMN profiles.has_notifications IS 'Tracks whether user currently has notifications enabled in Neynar';
COMMENT ON COLUMN profiles.notification_status_updated_at IS 'Last time we checked/updated the notification status from Neynar'; 