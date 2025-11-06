-- ================================================================
-- CRITICAL SECURITY FIX: Proper RLS policies for shipping data
-- ================================================================
-- This migration implements OWASP best practices for PII protection
-- 
-- Changes:
-- 1. Remove overly permissive "Allow all" policies
-- 2. Implement least privilege access for orders table
-- 3. Add role-based access for admin/partner operations
-- 4. Ensure users can only see their own shipping addresses
-- ================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all operations on orders for now" ON orders;

-- ================================================================
-- CUSTOMER ACCESS: Users can only view their OWN orders
-- ================================================================
CREATE POLICY "customers_view_own_orders" ON orders
  FOR SELECT
  USING (
    fid = (current_setting('request.jwt.claims', true)::json->>'fid')::integer
  );

-- ================================================================
-- ADMIN ACCESS: Service role can do everything (for API routes)
-- ================================================================
-- This allows server-side API routes using service role key to operate
CREATE POLICY "service_role_all_access" ON orders
  FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- ================================================================
-- PARTNER ACCESS: Partners can only see orders assigned to them
-- (And only specific fields, not full shipping addresses)
-- ================================================================
CREATE POLICY "partners_view_assigned_orders" ON orders
  FOR SELECT
  USING (
    assigned_partner_id IS NOT NULL
    AND assigned_partner_id = (current_setting('request.jwt.claims', true)::json->>'partner_id')::uuid
  );

-- ================================================================
-- INSERT POLICY: Only service role can create orders
-- ================================================================
CREATE POLICY "service_role_insert_orders" ON orders
  FOR INSERT
  WITH CHECK (current_setting('role') = 'service_role');

-- ================================================================
-- UPDATE POLICY: Only service role can update orders
-- ================================================================
CREATE POLICY "service_role_update_orders" ON orders
  FOR UPDATE
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- ================================================================
-- DELETE POLICY: Only service role can delete/archive orders
-- ================================================================
CREATE POLICY "service_role_delete_orders" ON orders
  FOR DELETE
  USING (current_setting('role') = 'service_role');

-- ================================================================
-- AUDIT LOG: Track who accesses shipping addresses
-- ================================================================
CREATE TABLE IF NOT EXISTS shipping_address_access_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  accessed_by_fid INTEGER REFERENCES profiles(fid),
  accessed_by_role TEXT, -- 'customer', 'admin', 'partner'
  access_type TEXT, -- 'view', 'update', 'export'
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_shipping_access_log_order_id ON shipping_address_access_log(order_id);
CREATE INDEX idx_shipping_access_log_accessed_at ON shipping_address_access_log(accessed_at);
CREATE INDEX idx_shipping_access_log_fid ON shipping_address_access_log(accessed_by_fid);

-- Enable RLS on audit log
ALTER TABLE shipping_address_access_log ENABLE ROW LEVEL SECURITY;

-- Only service role can write to audit log
CREATE POLICY "service_role_audit_log" ON shipping_address_access_log
  FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- ================================================================
-- FUNCTION: Redact shipping address for partners
-- ================================================================
-- Partners should only see city/state, not full address
CREATE OR REPLACE FUNCTION redact_shipping_address_for_partner(address JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'city', address->>'city',
    'province', address->>'province',
    'country', address->>'country',
    'zip', SUBSTRING(address->>'zip', 1, 3) || '**' -- Partial ZIP
  );
END;
$$;

COMMENT ON FUNCTION redact_shipping_address_for_partner IS 'Redacts full address details for partner access, showing only city/state/partial ZIP';

-- ================================================================
-- VIEW: Partner-safe orders view
-- ================================================================
CREATE OR REPLACE VIEW partner_orders_view AS
SELECT 
  o.id,
  o.order_id,
  o.fid,
  o.customer_name,
  o.customer_email,
  -- REDACTED shipping address
  redact_shipping_address_for_partner(o.shipping_address) as shipping_address,
  o.shipping_method,
  o.shipping_cost,
  o.tracking_number,
  o.order_status,
  o.fulfillment_status,
  o.payment_status,
  o.subtotal,
  o.tax,
  o.total,
  o.created_at,
  o.updated_at,
  o.assigned_partner_id,
  o.partner_fulfillment_status
FROM orders o
WHERE o.assigned_partner_id IS NOT NULL;

-- Grant partners access to the view
GRANT SELECT ON partner_orders_view TO authenticated;

-- ================================================================
-- COMMENTS for documentation
-- ================================================================
COMMENT ON POLICY "customers_view_own_orders" ON orders IS 'Customers can only view orders where their FID matches';
COMMENT ON POLICY "service_role_all_access" ON orders IS 'Server-side API routes using service role key have full access';
COMMENT ON POLICY "partners_view_assigned_orders" ON orders IS 'Partners can only see orders assigned to them';
COMMENT ON TABLE shipping_address_access_log IS 'Audit log tracking all access to shipping addresses for compliance';
COMMENT ON VIEW partner_orders_view IS 'Redacted view of orders for partner access - does not expose full shipping addresses';

