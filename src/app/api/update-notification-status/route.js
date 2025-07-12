import { NextResponse } from 'next/server';
import { setUserContext } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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
    
    // 🔒 SECURITY: Set user context for RLS policies
    await setUserContext(fid);

    // Update the user's notification status in the database
    const { data, error } = await supabase
      .from('profiles')
      .update({
        has_notifications: enabled,
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
    
    // If user doesn't exist, create profile
    if (!data || data.length === 0) {
      console.log(`👤 Creating new profile for FID ${fid} with notification status: ${enabled}`);
      
      const { data: newProfile, error: createError } = await supabase
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
    }
    
    console.log(`✅ Updated FID ${fid} notification status to ${enabled ? 'enabled' : 'disabled'}`);
    
    return NextResponse.json({
      success: true,
      message: `Notification status updated to ${enabled ? 'enabled' : 'disabled'}`,
      profile: data[0],
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

    // 🔒 SECURITY: Set user context for RLS policies
    await setUserContext(fid);
    
    // Get current notification status
    const { data, error } = await supabase
      .from('profiles')
      .select('fid, has_notifications, notification_status_updated_at, notification_status_source')
      .eq('fid', fid)
      .single();
    
    if (error) {
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