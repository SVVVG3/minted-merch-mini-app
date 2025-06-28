-- Minted Merch Mini App Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS discount_codes;
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
  
  -- Welcome notification tracking
  welcome_notification_sent BOOLEAN DEFAULT FALSE,
  welcome_notification_sent_at TIMESTAMP WITH TIME ZONE,
  
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

-- Discount codes table for tracking first-order discounts
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fid INTEGER NOT NULL REFERENCES profiles(fid) ON DELETE CASCADE,
  
  -- Discount code details
  code TEXT UNIQUE NOT NULL, -- Format: WELCOME15-{shortId}
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(5,2) NOT NULL DEFAULT 15.00, -- 15% for welcome discount
  
  -- Usage tracking
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  order_id TEXT, -- Reference to the order where this code was used
  
  -- Code metadata
  code_type TEXT NOT NULL DEFAULT 'welcome' CHECK (code_type IN ('welcome', 'promotional', 'referral')),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date
  minimum_order_amount DECIMAL(10,2), -- Optional minimum order requirement
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for discount_codes table
CREATE INDEX IF NOT EXISTS idx_discount_codes_fid ON discount_codes(fid);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_used ON discount_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code_type ON discount_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_discount_codes_expires_at ON discount_codes(expires_at);

-- Enable RLS for discount_codes
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for discount_codes table
CREATE POLICY "Users can view their own discount codes" ON discount_codes
  FOR SELECT USING (fid = (SELECT fid FROM profiles WHERE fid = discount_codes.fid));

CREATE POLICY "Allow all operations on discount_codes for now" ON discount_codes
  FOR ALL USING (true);

-- Trigger to update updated_at for discount_codes
CREATE TRIGGER update_discount_codes_updated_at 
  BEFORE UPDATE ON discount_codes 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Orders table for tracking order lifecycle and notifications
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fid INTEGER NOT NULL REFERENCES profiles(fid) ON DELETE CASCADE,
  
  -- Order identification
  order_id TEXT UNIQUE NOT NULL, -- External order ID from payment processor
  session_id TEXT, -- Checkout session ID for reference
  
  -- Order details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  currency TEXT NOT NULL DEFAULT 'USDC',
  amount_total DECIMAL(10,2) NOT NULL,
  amount_subtotal DECIMAL(10,2),
  amount_tax DECIMAL(10,2),
  amount_shipping DECIMAL(10,2),
  
  -- Customer information
  customer_email TEXT,
  customer_name TEXT,
  
  -- Shipping information
  shipping_address JSONB, -- Store complete shipping address as JSON
  shipping_method TEXT,
  shipping_cost DECIMAL(10,2),
  
  -- Tracking information
  tracking_number TEXT,
  tracking_url TEXT,
  carrier TEXT, -- UPS, FedEx, USPS, etc.
  
  -- Product information
  line_items JSONB NOT NULL, -- Array of products ordered (primary storage)
  
  -- Payment information
  payment_method TEXT,
  payment_status TEXT,
  payment_intent_id TEXT,
  
  -- Discount information
  discount_code TEXT, -- The discount code used for this order
  discount_amount DECIMAL(10,2) DEFAULT 0.00, -- Amount discounted
  discount_percentage DECIMAL(5,2), -- Percentage discount applied
  
  -- Archive tracking (DO NOT DELETE ORDERS - ARCHIVE THEM INSTEAD)
  archived_at TIMESTAMP WITH TIME ZONE, -- When order was archived
  archived_in_shopify BOOLEAN DEFAULT FALSE, -- Whether archived in Shopify
  
  -- Notification tracking
  order_confirmation_sent BOOLEAN DEFAULT FALSE,
  order_confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  shipping_notification_sent BOOLEAN DEFAULT FALSE,
  shipping_notification_sent_at TIMESTAMP WITH TIME ZONE,
  delivery_notification_sent BOOLEAN DEFAULT FALSE,
  delivery_notification_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_fid ON orders(fid);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON orders(archived_at);
CREATE INDEX IF NOT EXISTS idx_orders_archived_in_shopify ON orders(archived_in_shopify);

-- Enable RLS for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies for orders table
CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (fid = (SELECT fid FROM profiles WHERE fid = orders.fid));

CREATE POLICY "Allow all operations on orders for now" ON orders
  FOR ALL USING (true);

-- Trigger to update updated_at for orders
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Order items table for detailed product tracking
-- NOTE: This table provides normalized storage of line items for advanced querying
-- The primary line items data is stored in orders.line_items JSONB column
-- This table is automatically populated when orders are created
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Product information
  product_id TEXT NOT NULL,
  product_handle TEXT,
  product_title TEXT NOT NULL,
  variant_id TEXT,
  variant_title TEXT,
  sku TEXT,
  
  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total DECIMAL(10,2) NOT NULL,
  
  -- Product details (complete product data from line_items)
  product_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Enable RLS for order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policy for order_items
CREATE POLICY "Users can view items for their orders" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE fid = (SELECT fid FROM profiles WHERE fid = orders.fid)
    )
  );

CREATE POLICY "Allow all operations on order_items for now" ON order_items
  FOR ALL USING (true); 