import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Profile management functions
export async function createOrUpdateProfile(fid, userData) {
  try {
    console.log('Creating/updating profile for FID:', fid, 'with data:', userData);
    
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        fid: fid,
        username: userData.username || `user_${fid}`,
        display_name: userData.displayName || null,
        bio: userData.bio || null,
        pfp_url: userData.pfpUrl || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'fid',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating profile:', error);
      return { success: false, error: error.message };
    }

    console.log('Profile created/updated successfully:', data);
    return { success: true, profile: data, isNew: !data.created_at };
  } catch (error) {
    console.error('Unexpected error in createOrUpdateProfile:', error);
    return { success: false, error: error.message };
  }
}

export async function getProfile(fid) {
  try {
    console.log('Getting profile for FID:', fid);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('fid', fid)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error getting profile:', error);
      return { success: false, error: error.message };
    }

    console.log('Profile retrieved:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('Unexpected error in getProfile:', error);
    return { success: false, error: error.message };
  }
}

export async function enableNotifications(fid, notificationToken, notificationUrl = 'https://api.farcaster.xyz/v1/frame-notifications') {
  try {
    console.log('Enabling notifications for FID:', fid, 'with token:', notificationToken);
    
    const { data, error } = await supabase
      .from('profiles')
      .update({
        notifications_enabled: true,
        notification_token: notificationToken,
        notification_url: notificationUrl,
        updated_at: new Date().toISOString()
      })
      .eq('fid', fid)
      .select()
      .single();

    if (error) {
      console.error('Error enabling notifications:', error);
      return { success: false, error: error.message };
    }

    console.log('Notifications enabled successfully:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('Unexpected error in enableNotifications:', error);
    return { success: false, error: error.message };
  }
}

export async function disableNotifications(fid) {
  try {
    console.log('Disabling notifications for FID:', fid);
    
    const { data, error } = await supabase
      .from('profiles')
      .update({
        notifications_enabled: false,
        notification_token: null,
        notification_url: 'https://api.farcaster.xyz/v1/frame-notifications',
        updated_at: new Date().toISOString()
      })
      .eq('fid', fid)
      .select()
      .single();

    if (error) {
      console.error('Error disabling notifications:', error);
      return { success: false, error: error.message };
    }

    console.log('Notifications disabled successfully:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('Unexpected error in disableNotifications:', error);
    return { success: false, error: error.message };
  }
}

export async function getNotificationToken(fid) {
  try {
    console.log('Getting notification token for FID:', fid);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('notification_token, notification_url, notifications_enabled')
      .eq('fid', fid)
      .eq('notifications_enabled', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error getting notification token:', error);
      return { success: false, error: error.message };
    }

    if (!data || !data.notifications_enabled) {
      console.log('No active notification token found for FID:', fid);
      return { success: true, token: null };
    }

    console.log('Notification token retrieved for FID:', fid);
    return { 
      success: true, 
      token: data.notification_token,
      url: data.notification_url
    };
  } catch (error) {
    console.error('Unexpected error in getNotificationToken:', error);
    return { success: false, error: error.message };
  }
}

export async function getAllNotificationTokens() {
  try {
    console.log('Getting all active notification tokens');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('fid, notification_token, notification_url')
      .eq('notifications_enabled', true)
      .not('notification_token', 'is', null);

    if (error) {
      console.error('Error getting all notification tokens:', error);
      return { success: false, error: error.message };
    }

    console.log('Retrieved', data?.length || 0, 'active notification tokens');
    return { success: true, tokens: data || [] };
  } catch (error) {
    console.error('Unexpected error in getAllNotificationTokens:', error);
    return { success: false, error: error.message };
  }
}

export async function getUsersWithNotifications() {
  try {
    console.log('Getting users with notifications enabled');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('notifications_enabled', true);

    if (error) {
      console.error('Error getting users with notifications:', error);
      return { success: false, error: error.message };
    }

    console.log('Found', data?.length || 0, 'users with notifications enabled');
    return { success: true, users: data || [] };
  } catch (error) {
    console.error('Unexpected error in getUsersWithNotifications:', error);
    return { success: false, error: error.message };
  }
} 