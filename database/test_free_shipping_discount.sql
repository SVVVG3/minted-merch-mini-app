-- Test Free Shipping Discount Code
-- This creates a sample discount code for testing the free shipping functionality

-- Create a test discount code with 20% off + free shipping
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
  
  -- Scope
  discount_scope,
  
  -- Metadata
  discount_description,
  internal_notes,
  priority_level,
  
  -- No expiration for testing
  expires_at
) VALUES (
  'FREESHIP20',  -- Code
  'percentage',   -- Type
  20.00,         -- 20% discount
  'promotional', -- Category
  
  -- Enable free shipping
  TRUE,          -- free_shipping
  
  -- Shared code setup
  TRUE,          -- is_shared_code
  NULL,          -- fid (shared codes have no owner)
  
  -- Usage limits
  50,            -- max_uses_total (50 total uses)
  1,             -- max_uses_per_user (once per user)
  0,             -- current_total_uses (starting count)
  
  -- Apply site-wide
  'site_wide',   -- discount_scope
  
  -- Documentation
  '20% discount with free shipping for giveaways and promotions',
  'Test discount code for free shipping functionality',
  5,             -- medium priority
  
  -- No expiration (for testing)
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
  discount_description,
  created_at
FROM discount_codes 
WHERE code = 'FREESHIP20';

-- Test query to show all discounts with free shipping
SELECT 
  code,
  discount_value,
  discount_type,
  free_shipping,
  discount_scope,
  discount_description
FROM discount_codes 
WHERE free_shipping = TRUE
ORDER BY created_at DESC; 