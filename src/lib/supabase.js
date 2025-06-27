import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create Supabase client
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Helper function to check if Supabase is available
export function isSupabaseAvailable() {
  return supabase !== null;
}

// Create or update user profile (simplified - no notification tokens)
export async function createOrUpdateUserProfile(profileData) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Creating/updating user profile:', profileData);

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        fid: profileData.fid,
        username: profileData.username,
        display_name: profileData.display_name,
        bio: profileData.bio,
        pfp_url: profileData.pfp_url,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'fid',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating/updating profile:', error);
      return { success: false, error: error.message };
    }

    console.log('Profile created/updated successfully:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('Error creating/updating profile:', error);
    return { success: false, error: error.message };
  }
}

// Get user profile by FID
export async function getUserProfile(userFid) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Getting user profile for FID:', userFid);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('fid', userFid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        console.log('No profile found for FID:', userFid);
        return { success: true, profile: null };
      }
      console.error('Supabase error getting profile:', error);
      return { success: false, error: error.message };
    }

    console.log('Profile found:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('Error getting profile:', error);
    return { success: false, error: error.message };
  }
}

// Get all user profiles (for admin/debug purposes)
export async function getAllProfiles() {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Getting all user profiles...');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error getting profiles:', error);
      return { success: false, error: error.message };
    }

    console.log(`Found ${data?.length || 0} profiles`);
    return { success: true, profiles: data || [] };
  } catch (error) {
    console.error('Error getting profiles:', error);
    return { success: false, error: error.message };
  }
}

// Update user profile
export async function updateUserProfile(userFid, updates) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Updating user profile for FID:', userFid, 'with updates:', updates);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('fid', userFid)
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating profile:', error);
      return { success: false, error: error.message };
    }

    console.log('Profile updated successfully:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { success: false, error: error.message };
  }
}

// Delete user profile
export async function deleteUserProfile(userFid) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Deleting user profile for FID:', userFid);

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('fid', userFid);

    if (error) {
      console.error('Supabase error deleting profile:', error);
      return { success: false, error: error.message };
    }

    console.log('Profile deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Error deleting profile:', error);
    return { success: false, error: error.message };
  }
}

// Mark welcome notification as sent for a user
export async function markWelcomeNotificationSent(userFid) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Marking welcome notification as sent for FID:', userFid);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        welcome_notification_sent: true,
        welcome_notification_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('fid', userFid)
      .select()
      .single();

    if (error) {
      console.error('Supabase error marking welcome notification sent:', error);
      return { success: false, error: error.message };
    }

    console.log('Welcome notification marked as sent:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('Error marking welcome notification sent:', error);
    return { success: false, error: error.message };
  }
}

// Check if welcome notification was already sent to a user
export async function hasWelcomeNotificationBeenSent(userFid) {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log('Checking if welcome notification was sent for FID:', userFid);

    const { data, error } = await supabase
      .from('profiles')
      .select('welcome_notification_sent, welcome_notification_sent_at')
      .eq('fid', userFid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found - notification not sent
        console.log('No profile found for FID:', userFid, '- notification not sent');
        return { success: true, sent: false };
      }
      console.error('Supabase error checking welcome notification status:', error);
      return { success: false, error: error.message };
    }

    const sent = data?.welcome_notification_sent || false;
    console.log('Welcome notification sent status for FID:', userFid, '- sent:', sent);
    return { success: true, sent, sentAt: data?.welcome_notification_sent_at };
  } catch (error) {
    console.error('Error checking welcome notification status:', error);
    return { success: false, error: error.message };
  }
}

// Get profile count (for debugging)
export async function getProfileCount() {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Supabase error getting profile count:', error);
      return { success: false, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Error getting profile count:', error);
    return { success: false, error: error.message };
  }
}

// Test Supabase connection
export async function testSupabaseConnection() {
  if (!isSupabaseAvailable()) {
    return { 
      success: false, 
      error: 'Supabase not configured',
      supabaseAvailable: false 
    };
  }

  try {
    console.log('Testing Supabase connection...');
    
    // Test basic connectivity by getting profile count
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Supabase connection test failed:', error);
      return { 
        success: false, 
        error: error.message,
        supabaseAvailable: true,
        connected: false
      };
    }

    console.log('Supabase connection test successful, profile count:', count);
    return { 
      success: true, 
      supabaseAvailable: true,
      connected: true,
      profileCount: count || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    return { 
      success: false, 
      error: error.message,
      supabaseAvailable: true,
      connected: false
    };
  }
} 