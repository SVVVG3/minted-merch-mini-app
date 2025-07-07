-- Dickbutt Cap Free Giveaway Discount Code
-- 100% free Dickbutt cap with free shipping

-- Create a product-specific discount code for Dickbutt cap giveaway
INSERT INTO discount_codes (
  code,
  discount_type,
  discount_value,
  code_type,
  
  -- Free shipping flag
  free_shipping,
  
  -- Shared code configuration
  is_shared_code,
  fid, -- NULL for shared codes
  
  -- Usage limits
  max_uses_total,
  max_uses_per_user,
  current_total_uses,
  
  -- Scope and targeting
  discount_scope,
  target_products,
  
  -- Metadata
  discount_description,
  internal_notes,
  priority_level,
  
  -- No expiration for giveaway
  expires_at
) VALUES (
  'DICKBUTT-FREE',  -- Code
  'percentage',      -- Type
  100.00,           -- 100% discount (completely free)
  'promotional',    -- Category
  
  -- Enable free shipping
  TRUE,             -- free_shipping
  
  -- Shared code setup for giveaway
  TRUE,             -- is_shared_code
  NULL,             -- fid (shared codes have no owner)
  
  -- Usage limits for giveaway
  5,                -- max_uses_total (5 free caps)
  1,                -- max_uses_per_user (once per user)
  0,                -- current_total_uses (starting count)
  
  -- Product-specific targeting
  'product',        -- discount_scope
  '["dickbutt-cap"]'::jsonb,  -- target_products (only for Dickbutt cap)
  
  -- Documentation
  '100% free Dickbutt cap with free shipping - limited giveaway',
  'Product-specific free giveaway for Dickbutt cap with free shipping',
  10,               -- high priority
  
  -- No expiration (for giveaway)
  NULL
);

-- Verify the discount was created
SELECT 
  code,
  discount_value,
  discount_type,
  free_shipping,
  is_shared_code,
  max_uses_total,
  max_uses_per_user,
  discount_scope,
  target_products,
  discount_description,
  created_at
FROM discount_codes 
WHERE code = 'DICKBUTT-FREE';

-- Test query to show all discounts with free shipping
SELECT 
  code,
  discount_value,
  discount_type,
  free_shipping,
  discount_scope,
  target_products,
  discount_description
FROM discount_codes 
WHERE free_shipping = TRUE
ORDER BY created_at DESC; 