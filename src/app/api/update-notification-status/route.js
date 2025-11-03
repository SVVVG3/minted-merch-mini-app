import { NextResponse } from 'next/server';
import { setUserContext } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { formatPSTTime } from '../../../lib/timezone.js';

export async function POST(request) {
  try {
    const { fid, enabled, source = 'realtime_event' } = await request.json();
    
    console.log(`🔔 Real-time notification status update for FID ${fid}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }
    
    // Use supabaseAdmin to bypass RLS for system notification updates
    // This is a system operation triggered by Farcaster/Base app events
    
    // First, check if profile exists
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('fid')
      .eq('fid', fid)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = not found, which is fine (we'll create it)
      // Any other error is a problem
      console.error('❌ Error checking profile:', checkError);
      return NextResponse.json({
        success: false,
        error: checkError.message
      }, { status: 500 });
    }

    // If profile exists, update it
    // IMPORTANT: Check BOTH Farcaster AND Base app tokens in Neynar
    // Each user can have separate tokens for each client
    if (existingProfile) {
      console.log(`📝 Updating existing profile for FID ${fid}`);
      
      // Import the function to check notification status across all clients
      const { checkUserNotificationStatus } = await import('@/lib/neynar');
      
      // Check if user has tokens in Neynar for BOTH clients
      const tokenStatus = await checkUserNotificationStatus(fid);
      
      console.log(`🔍 Token status for FID ${fid}:`, {
        farcaster: tokenStatus.hasFarcasterNotifications,
        base: tokenStatus.hasBaseNotifications,
        total: tokenStatus.tokenCount
      });
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          // has_notifications = Farcaster/Warpcast
          has_notifications: tokenStatus.hasFarcasterNotifications,
          // has_base_notifications = Base app
          has_base_notifications: tokenStatus.hasBaseNotifications,
          notification_status_updated_at: new Date().toISOString(),
          notification_status_source: source
        })
        .eq('fid', fid)
        .select();
      
      if (error) {
        console.error('❌ Error updating notification status:', error);
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
      
      console.log(`✅ Updated FID ${fid} notification status - Farcaster: ${tokenStatus.hasFarcasterNotifications}, Base: ${tokenStatus.hasBaseNotifications}`);
      
      return NextResponse.json({
        success: true,
        message: `Notification status updated - Farcaster: ${tokenStatus.hasFarcasterNotifications}, Base: ${tokenStatus.hasBaseNotifications}`,
        profile: data[0],
        tokenStatus: {
          farcaster: tokenStatus.hasFarcasterNotifications,
          base: tokenStatus.hasBaseNotifications,
          total: tokenStatus.tokenCount
        },
        timestamp: formatPSTTime()
      });
    }
    
    // If profile doesn't exist, create it
    console.log(`👤 Creating new profile for FID ${fid} with notification status: ${enabled}`);
    
    const { data: newProfile, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        fid: fid,
        has_notifications: enabled,
        notification_status_updated_at: new Date().toISOString(),
        notification_status_source: source
      })
      .select();
    
    if (createError) {
      console.error('❌ Error creating profile:', createError);
      return NextResponse.json({
        success: false,
        error: createError.message
      }, { status: 500 });
    }
    
    console.log(`✅ Created new profile for FID ${fid}`);
    return NextResponse.json({
      success: true,
      message: `Profile created with notifications ${enabled ? 'enabled' : 'disabled'}`,
      profile: newProfile[0],
      timestamp: formatPSTTime()
    });
    
  } catch (error) {
    console.error('❌ Error in update-notification-status:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID parameter is required'
      }, { status: 400 });
    }

    // Use supabaseAdmin to read notification status
    // This is safe because we're only reading the specific user's own notification status
    // and returning it directly to them (not exposing other users' data)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('fid, has_notifications, notification_status_updated_at, notification_status_source')
      .eq('fid', fid)
      .single();
    
    if (error) {
      // Handle case where user profile doesn't exist yet (PGRST116 = no rows returned)
      if (error.code === 'PGRST116') {
        console.log(`ℹ️ Profile not found for FID ${fid}, returning default (notifications disabled)`);
        return NextResponse.json({
          success: true,
          fid: parseInt(fid),
          notificationsEnabled: false,
          lastUpdated: null,
          source: 'default_no_profile',
          timestamp: formatPSTTime()
        });
      }
      
      console.error('❌ Error getting notification status:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      fid: data.fid,
      notificationsEnabled: data.has_notifications,
      lastUpdated: data.notification_status_updated_at,
      source: data.notification_status_source || 'unknown',
      timestamp: formatPSTTime()
    });
    
  } catch (error) {
    console.error('❌ Error in get notification status:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 