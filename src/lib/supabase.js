import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Database features will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper function to check if Supabase is available
export function isSupabaseAvailable() {
  return supabase !== null;
}

// Get or create user profile
export async function getOrCreateProfile(fid, userData = {}) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available, skipping profile operations');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // First, try to get existing profile
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('fid', fid)
      .single();

    if (existingProfile && !fetchError) {
      console.log('Found existing profile for FID:', fid);
      return { success: true, profile: existingProfile, isNew: false };
    }

    // If profile doesn't exist, create it
    console.log('Creating new profile for FID:', fid);
    const profileData = {
      fid: fid,
      username: userData.username || `user_${fid}`,
      display_name: userData.display_name || userData.displayName || null,
      bio: userData.bio || null,
      pfp_url: userData.pfp_url || userData.pfpUrl || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      return { success: false, error: createError.message };
    }

    console.log('Created new profile:', newProfile);
    return { success: true, profile: newProfile, isNew: true };

  } catch (error) {
    console.error('Error in getOrCreateProfile:', error);
    return { success: false, error: error.message };
  }
}

// Store notification token for a user
export async function storeNotificationToken(fid, notificationDetails) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available, skipping token storage');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Storing notification token for FID:', fid);
    
    const tokenData = {
      fid: fid,
      token: notificationDetails.token,
      url: notificationDetails.url,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Use upsert to handle both insert and update cases
    const { data, error } = await supabase
      .from('notification_tokens')
      .upsert(tokenData, { 
        onConflict: 'fid',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing notification token:', error);
      return { success: false, error: error.message };
    }

    console.log('Stored notification token successfully:', data);
    return { success: true, data: data };

  } catch (error) {
    console.error('Error in storeNotificationToken:', error);
    return { success: false, error: error.message };
  }
}

// Get notification token for a user
export async function getNotificationToken(fid) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available, skipping token retrieval');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('notification_tokens')
      .select('*')
      .eq('fid', fid)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error getting notification token:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      console.log('No active notification token found for FID:', fid);
      return { success: true, token: null };
    }

    console.log('Found notification token for FID:', fid);
    return { success: true, token: data };

  } catch (error) {
    console.error('Error in getNotificationToken:', error);
    return { success: false, error: error.message };
  }
}

// Disable notification token for a user
export async function disableNotificationToken(fid) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available, skipping token disable');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Disabling notification token for FID:', fid);
    
    const { data, error } = await supabase
      .from('notification_tokens')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('fid', fid)
      .select();

    if (error) {
      console.error('Error disabling notification token:', error);
      return { success: false, error: error.message };
    }

    console.log('Disabled notification token for FID:', fid);
    return { success: true, data: data };

  } catch (error) {
    console.error('Error in disableNotificationToken:', error);
    return { success: false, error: error.message };
  }
}

// Get all users with active notification tokens
export async function getUsersWithNotifications() {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available, skipping users query');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('notification_tokens')
      .select(`
        *,
        profiles (
          username,
          display_name,
          pfp_url
        )
      `)
      .eq('is_active', true);

    if (error) {
      console.error('Error getting users with notifications:', error);
      return { success: false, error: error.message };
    }

    console.log(`Found ${data?.length || 0} users with active notification tokens`);
    return { success: true, users: data || [] };

  } catch (error) {
    console.error('Error in getUsersWithNotifications:', error);
    return { success: false, error: error.message };
  }
} 