import { supabaseAdmin } from './supabase';

/**
 * Log security events for audit trail
 */
export async function logSecurityEvent(eventType, details = {}, fid = null, request = null) {
  try {
    const logEntry = {
      event_type: eventType,
      user_fid: fid,
      details: details,
      created_at: new Date().toISOString()
    };

    // Extract IP and user agent from request if provided
    if (request) {
      logEntry.ip_address = request.headers.get('x-forwarded-for') || 
                           request.headers.get('x-real-ip') || 
                           'unknown';
      logEntry.user_agent = request.headers.get('user-agent') || 'unknown';
    }

    const { error } = await supabaseAdmin
      .from('security_audit_log')
      .insert([logEntry]);

    if (error) {
      console.error('Failed to log security event:', error);
    } else {
      console.log(`🔒 Security event logged: ${eventType}`, { fid, eventType });
    }
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

/**
 * Validate that client-provided discount amount matches server calculation
 */
export function validateDiscountAmount(clientAmount, serverAmount, tolerance = 0.20) {
  const client = parseFloat(clientAmount) || 0;
  const server = parseFloat(serverAmount) || 0;
  
  return Math.abs(client - server) <= tolerance;
}

/**
 * Security middleware to check for suspicious activity patterns
 */
export async function checkSuspiciousActivity(fid, eventType, details = {}) {
  try {
    // Check for repeated suspicious events from same user in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentEvents, error } = await supabaseAdmin
      .from('security_audit_log')
      .select('id, event_type, created_at')
      .eq('user_fid', fid)
      .eq('event_type', eventType)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error checking suspicious activity:', error);
      return { suspicious: false };
    }

    const eventCount = recentEvents?.length || 0;
    
    // Flag as suspicious if more than 3 similar events in last hour
    if (eventCount >= 3) {
      return {
        suspicious: true,
        reason: `Multiple ${eventType} events detected`,
        eventCount: eventCount,
        recentEvents: recentEvents
      };
    }

    return { suspicious: false };
  } catch (error) {
    console.error('Error in suspicious activity check:', error);
    return { suspicious: false };
  }
}
