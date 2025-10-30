-- Migration: Add email column to profiles table
-- Date: January 2025
-- Purpose: Centralize user email data and link order emails to user profiles

-- Add email column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS email_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Add comment for documentation
COMMENT ON COLUMN profiles.email IS 'User email address, populated from order data or user registration';
COMMENT ON COLUMN profiles.email_updated_at IS 'Last time email was updated';

-- Populate email from existing orders
-- This will set the email to the most recent order's customer_email for each FID
UPDATE profiles 
SET 
  email = recent_orders.customer_email,
  email_updated_at = recent_orders.created_at
FROM (
  SELECT DISTINCT ON (fid) 
    fid, 
    customer_email, 
    created_at
  FROM orders 
  WHERE customer_email IS NOT NULL 
    AND customer_email != '' 
    AND customer_email LIKE '%@%'  -- Basic email validation
  ORDER BY fid, created_at DESC
) AS recent_orders
WHERE profiles.fid = recent_orders.fid
  AND profiles.email IS NULL; -- Only update if email is not already set

-- Create a function to automatically update profile email from orders
CREATE OR REPLACE FUNCTION update_profile_email_from_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile email if order has a customer email
  IF NEW.customer_email IS NOT NULL AND NEW.customer_email != '' AND NEW.customer_email LIKE '%@%' THEN
    UPDATE profiles 
    SET 
      email = NEW.customer_email,
      email_updated_at = NOW()
    WHERE fid = NEW.fid 
      AND (email IS NULL OR email != NEW.customer_email);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update profile email when orders are created or updated
CREATE TRIGGER update_profile_email_on_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_email_from_order();

CREATE TRIGGER update_profile_email_on_order_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.customer_email IS DISTINCT FROM NEW.customer_email)
  EXECUTE FUNCTION update_profile_email_from_order(); 