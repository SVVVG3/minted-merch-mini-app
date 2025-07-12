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