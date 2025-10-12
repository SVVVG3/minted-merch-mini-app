import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    
    // Get raw body for logging and parsing
    const rawBody = await request.text();
    console.log('Webhook raw body received, length:', rawBody.length);
    console.log('Raw body sample:', rawBody.substring(0, 200));
    
    // Try to parse the webhook data
    let webhookData;
    try {
      webhookData = JSON.parse(rawBody);
      console.log('📦 Parsed webhook data:', JSON.stringify(webhookData, null, 2));
    } catch (parseError) {
      console.error('Failed to parse webhook body:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid JSON'
      }, { status: 400 });
    }

    // Check if this is a Base app notification event
    // Base app events have structure: { fid, event: { event: "miniapp_added", notificationDetails: {...} } }
    if (webhookData.event && webhookData.event.event) {
      console.log('🔵 Base app event detected:', webhookData.event.event);
      await handleBaseAppEvent(webhookData);
    } 
    // Otherwise, assume it's a Neynar/Farcaster event (handled by Neynar automatically)
    else {
      console.log('🟣 Farcaster/Neynar event (managed automatically by Neynar)');
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Handle Base app notification events
 * These are separate from Farcaster/Neynar events
 */
async function handleBaseAppEvent(webhookData) {
  const { fid, event } = webhookData;
  const eventType = event.event;
  const notificationDetails = event.notificationDetails;

  console.log(`🔵 Handling Base app event for FID ${fid}: ${eventType}`);

  try {
    switch (eventType) {
      case 'miniapp_added':
        // User added mini app in Base app
        if (notificationDetails) {
          await saveBaseAppNotificationToken(fid, notificationDetails);
          console.log(`✅ Saved Base app notification token for FID ${fid}`);
          
          // Don't mark has_notifications=true here, only when they explicitly enable notifications
          // This prevents overriding Farcaster notification status
        }
        break;

      case 'miniapp_removed':
        // User removed mini app from Base app
        // Only remove Base app tokens, keep Farcaster tokens
        await removeBaseAppNotificationToken(fid);
        console.log(`✅ Removed Base app notification token for FID ${fid}`);
        break;

      case 'notifications_enabled':
        // User enabled notifications in Base app
        if (notificationDetails) {
          await saveBaseAppNotificationToken(fid, notificationDetails);
          // Mark has_notifications=true for Base app
          await supabaseAdmin
            .from('profiles')
            .update({
              has_base_notifications: true,
              notification_status_updated_at: new Date().toISOString()
            })
            .eq('fid', fid);
          console.log(`✅ Enabled Base app notifications for FID ${fid}`);
        }
        break;

      case 'notifications_disabled':
        // User disabled notifications in Base app
        await removeBaseAppNotificationToken(fid);
        await supabaseAdmin
          .from('profiles')
          .update({
            has_base_notifications: false,
            notification_status_updated_at: new Date().toISOString()
          })
          .eq('fid', fid);
        console.log(`✅ Disabled Base app notifications for FID ${fid}`);
        break;

      default:
        console.log(`⚠️ Unknown Base app event type: ${eventType}`);
    }
  } catch (error) {
    console.error(`❌ Error handling Base app event for FID ${fid}:`, error);
    throw error;
  }
}

/**
 * Save Base app notification token to database
 */
async function saveBaseAppNotificationToken(fid, notificationDetails) {
  const { url, token } = notificationDetails;
  
  // Store in a new table for Base app tokens (separate from Neynar)
  const { error } = await supabaseAdmin
    .from('base_app_notification_tokens')
    .upsert({
      fid: fid,
      notification_url: url,
      notification_token: token,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'fid'
    });

  if (error) {
    console.error('Error saving Base app notification token:', error);
    throw error;
  }
}

/**
 * Remove Base app notification token from database
 */
async function removeBaseAppNotificationToken(fid) {
  const { error } = await supabaseAdmin
    .from('base_app_notification_tokens')
    .delete()
    .eq('fid', fid);

  if (error) {
    console.error('Error removing Base app notification token:', error);
    throw error;
  }
}

// GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Minted Merch webhook endpoint is active (Neynar managed)',
    timestamp: new Date().toISOString()
  });
} 