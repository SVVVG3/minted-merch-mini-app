-- Fix RLS policies for discount_codes to allow access to shared codes
-- This fixes the token-gated discount auto-application that was broken by strict RLS policies

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can view their own discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Allow all operations on discount_codes for now" ON discount_codes;

-- Create new policies that properly handle shared codes
-- Policy 1: Users can view their own personal discount codes
CREATE POLICY "Users can view their own discount codes" ON discount_codes
  FOR SELECT USING (
    fid = (current_setting('app.user_fid')::integer)
  );

-- Policy 2: Everyone can view shared discount codes (auto-apply discounts)
CREATE POLICY "Everyone can view shared discount codes" ON discount_codes
  FOR SELECT USING (
    fid IS NULL OR is_shared_code = true
  );

-- Policy 3: System operations (for admin/debug endpoints)
CREATE POLICY "System admin can access all discount codes" ON discount_codes
  FOR ALL USING (
    current_setting('app.user_fid') = '999999999'
  );

-- For INSERT/UPDATE/DELETE operations, only allow:
-- 1. System admin context
-- 2. Operations on user's own codes (for personal discount codes)
CREATE POLICY "System admin can modify discount codes" ON discount_codes
  FOR INSERT, UPDATE, DELETE USING (
    current_setting('app.user_fid') = '999999999' OR
    fid = (current_setting('app.user_fid')::integer)
  ); 