-- Add products table for managing Shopify product data
-- Migration: add_products_table.sql
-- Created: 2025-07-02

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  shopify_id TEXT UNIQUE NOT NULL,
  shopify_graphql_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  product_type TEXT,
  vendor TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  tags TEXT[],
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  variant_count INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);
CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_synced_at ON products(synced_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to products" ON products
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Allow admin operations (you can customize this based on your auth setup)
CREATE POLICY "Allow admin operations on products" ON products
  FOR ALL USING (auth.role() = 'service_role');

-- Update discount_codes table to reference products table
-- Add column for product targeting (array of product IDs)
ALTER TABLE discount_codes 
ADD COLUMN IF NOT EXISTS target_product_ids INTEGER[];

-- Create index for product targeting
CREATE INDEX IF NOT EXISTS idx_discount_codes_target_products ON discount_codes USING GIN(target_product_ids);

-- Insert comment for documentation
COMMENT ON TABLE products IS 'Stores Shopify product data for discount targeting and management';
COMMENT ON COLUMN products.handle IS 'Shopify product handle (URL slug)';
COMMENT ON COLUMN products.shopify_id IS 'Shopify REST API product ID';
COMMENT ON COLUMN products.shopify_graphql_id IS 'Shopify GraphQL API product ID (gid://shopify/Product/...)';
COMMENT ON COLUMN discount_codes.target_product_ids IS 'Array of product IDs this discount applies to (NULL = site-wide)'; 