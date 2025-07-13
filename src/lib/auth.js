import { supabase } from './supabase';

/**
 * Set user context for RLS policies - SECURITY CRITICAL
 * Call this before any Supabase query that should be user-scoped
 */
export async function setUserContext(fid) {
  if (!fid) {
    throw new Error('FID is required for user context');
  }
  
  console.log(`🔒 Setting user context for FID: ${fid}`);
  
  await supabase.rpc('set_config', {
    parameter: 'app.user_fid', 
    value: fid.toString()
  });
}

/**
 * Set system admin context for operations that need access to multiple users' data
 * Use ONLY for legitimate admin/debug/system operations like:
 * - Debug endpoints (getAllProfiles)
 * - Discount validation across users
 * - System maintenance operations
 */
export async function setSystemContext() {
  console.log(`🔧 Setting system admin context for multi-user operations`);
  
  await supabase.rpc('set_config', {
    parameter: 'app.user_fid', 
    value: 'system_admin'
  });
} 