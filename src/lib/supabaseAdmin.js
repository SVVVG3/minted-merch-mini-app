import { createClient } from '@supabase/supabase-js'

/**
 * Get Supabase admin client with proper error handling
 * This function creates a Supabase client with service role key
 * and handles missing environment variables gracefully
 */
export function getSupabaseAdmin() {
  // Skip during build time to prevent build failures
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    console.warn('Skipping Supabase admin client creation during build')
    return null
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  // During build time, environment variables might not be available
  // Return null instead of throwing to prevent build failures
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Supabase environment variables not available during build time')
    return null
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
