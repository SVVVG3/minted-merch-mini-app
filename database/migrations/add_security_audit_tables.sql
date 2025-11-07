-- ================================================================
-- SECURITY AUDIT TABLES
-- ================================================================
-- Creates tables for logging security events and monitoring
-- payment verification, amount mismatches, and unauthorized access attempts

-- Security audit log table
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_fid INTEGER REFERENCES profiles(fid),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_fid ON security_audit_log(user_fid);

-- Security events table (simpler version for webhook logging)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);

-- Enable RLS
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access security tables
CREATE POLICY "service_role_security_audit" ON security_audit_log
  FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "service_role_security_events" ON security_events
  FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE security_audit_log IS 'Logs security events for audit trail including payment verification, unauthorized access attempts, and suspicious activity';
COMMENT ON TABLE security_events IS 'Simplified security event logging for webhooks and system events';

