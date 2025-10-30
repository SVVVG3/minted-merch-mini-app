-- Fix products table RLS policies to match other tables
-- Migration: fix_products_table_rls_policies.sql
-- Created: 2025-07-02

-- Drop the restrictive policies
DROP POLICY IF EXISTS "Allow read access to products" ON products;
DROP POLICY IF EXISTS "Allow admin operations on products" ON products;

-- Add permissive policy like other tables
CREATE POLICY "Allow all operations on products for now" ON products
  FOR ALL USING (true);

-- Add comment for future reference
COMMENT ON POLICY "Allow all operations on products for now" ON products 
IS 'Permissive policy allowing all operations - matches pattern used by other tables (profiles, discount_codes, orders)'; 