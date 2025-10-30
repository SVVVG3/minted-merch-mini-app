-- Fix RLS policies for orders table to match other tables
-- This fixes the order creation failures due to RLS policy violations
-- Migration: fix_orders_table_rls_policies.sql
-- Date: January 2025

-- Drop existing policies that use the old pattern
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Allow all operations on orders for now" ON orders;

-- Create new policies that properly handle authentication context
-- Policy 1: Users can view their own orders
CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (
    fid = (current_setting('app.user_fid')::integer)
  );

-- Policy 2: System admin can access all orders (for order creation, admin endpoints)
CREATE POLICY "System admin can access all orders" ON orders
  FOR ALL USING (
    current_setting('app.user_fid') = '999999999'
  );

-- Policy 3: Allow INSERT operations for order creation (system context)
CREATE POLICY "System admin can create orders" ON orders
  FOR INSERT WITH CHECK (
    current_setting('app.user_fid') = '999999999'
  );

-- Policy 4: Allow UPDATE operations for order management (system context)
CREATE POLICY "System admin can update orders" ON orders
  FOR UPDATE USING (
    current_setting('app.user_fid') = '999999999'
  );

-- Fix order_items table RLS policies too
DROP POLICY IF EXISTS "Users can view items for their orders" ON order_items;
DROP POLICY IF EXISTS "Allow all operations on order_items for now" ON order_items;

-- Create new policies for order_items table
CREATE POLICY "Users can view items for their orders" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE fid = (current_setting('app.user_fid')::integer)
    )
  );

CREATE POLICY "System admin can access all order_items" ON order_items
  FOR ALL USING (
    current_setting('app.user_fid') = '999999999'
  );

-- Add comments for documentation
COMMENT ON POLICY "Users can view their own orders" ON orders 
IS 'Allow users to view orders associated with their FID';

COMMENT ON POLICY "System admin can access all orders" ON orders 
IS 'Allow system admin context (FID 999999999) to access all orders for creation, updates, and management';

COMMENT ON POLICY "System admin can create orders" ON orders 
IS 'Allow system admin context to create orders on behalf of users';

COMMENT ON POLICY "System admin can update orders" ON orders 
IS 'Allow system admin context to update orders for tracking, fulfillment, and status changes';

COMMENT ON POLICY "Users can view items for their orders" ON order_items 
IS 'Allow users to view order items for their own orders';

COMMENT ON POLICY "System admin can access all order_items" ON order_items 
IS 'Allow system admin context to access all order items for order creation and management'; 