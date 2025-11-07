-- ================================================================
-- 🚨 CRITICAL SECURITY FIX: Secure unrestricted tables/views
-- ================================================================
-- ISSUE: Two database objects were missing Row Level Security:
-- 1. webhook_logs (table) - contained sensitive payment data
-- 2. partner_orders_view (view) - had public access
--
-- This migration fixes both security vulnerabilities.
-- ================================================================

-- ================================================================
-- FIX 1: Enable RLS on webhook_logs table
-- ================================================================
-- This table contains sensitive payment information including:
-- - Payment IDs, transaction hashes, chain IDs
-- - Raw webhook payloads with customer data
-- - External order references

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook logs
CREATE POLICY "service_role_webhook_logs" ON webhook_logs
  FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

COMMENT ON TABLE webhook_logs IS 'Audit trail for webhook events - RLS enabled, service role only';

-- ================================================================
-- FIX 2: Restrict access to partner_orders_view
-- ================================================================
-- Views cannot have RLS directly in PostgreSQL, but we can
-- control access via GRANT/REVOKE. The view itself already
-- redacts sensitive shipping information via the
-- redact_shipping_address_for_partner() function.

-- Revoke all public access
REVOKE ALL ON partner_orders_view FROM PUBLIC;
REVOKE ALL ON partner_orders_view FROM anon;
REVOKE ALL ON partner_orders_view FROM authenticated;

-- Only service_role can access (for API endpoints)
GRANT SELECT ON partner_orders_view TO service_role;

COMMENT ON VIEW partner_orders_view IS 'Redacted order view for partners - Access restricted via GRANTs. Partners must use API endpoints that enforce authorization.';

-- ================================================================
-- SECURITY VERIFICATION
-- ================================================================
-- After running this migration, verify:
-- 1. webhook_logs shows RLS enabled in Supabase dashboard
-- 2. partner_orders_view shows restricted access
-- 3. Only service_role can query these objects
-- ================================================================

