import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hasNotificationTokenInNeynar, sendWelcomeNotification } from '@/lib/neynar';
import { createWelcomeDiscountCode } from '@/lib/discounts';

export async function POST(request) {
  try {
    const { fid, username, displayName, bio, pfpUrl } = await request.json();

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    console.log('Registering user:', { fid, username, displayName });

    // Check if user has notifications enabled (check this FIRST)
    const hasNotifications = await hasNotificationTokenInNeynar(fid);
    console.log('User has notifications enabled:', hasNotifications);

    // Create or update user profile with notification status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        fid,
        username,
        display_name: displayName,
        bio: bio || null,
        pfp_url: pfpUrl,
        has_notifications: hasNotifications, // ✅ Store notification status
        notification_status_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'fid'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
    }

    console.log('User profile created/updated:', profile);

    // Generate welcome discount code for new users (regardless of notification status)
    let discountCode = null;
    try {
      const discountResult = await createWelcomeDiscountCode(fid);
      if (discountResult.success) {
        discountCode = discountResult.code;
        console.log('✅ Welcome discount code generated:', discountCode, 'isExisting:', discountResult.isExisting);
      } else {
        console.log('⚠️ Could not create discount code:', discountResult.error);
      }
    } catch (discountError) {
      console.error('Error generating discount code:', discountError);
      // Don't fail registration if discount code generation fails
    }

    // Send welcome notification if user has notifications enabled and hasn't received it yet
    let welcomeNotificationSent = false;
    if (hasNotifications && !profile.welcome_notification_sent) {
      console.log('Sending welcome notification to user with notifications enabled');
      
      try {
        const notificationResult = await sendWelcomeNotification(fid);
        console.log('Welcome notification result:', notificationResult);

        if (notificationResult.success) {
          // Mark welcome notification as sent
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              welcome_notification_sent: true,
              welcome_notification_sent_at: new Date().toISOString()
            })
            .eq('fid', fid);

          if (updateError) {
            console.error('Error updating welcome notification status:', updateError);
          } else {
            console.log('Welcome notification marked as sent for FID:', fid);
            welcomeNotificationSent = true;
          }
        }
      } catch (notificationError) {
        console.error('Error sending welcome notification:', notificationError);
        // Don't fail the registration if notification fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      profile,
      hasNotifications,
      welcomeNotificationSent,
      discountCode: discountCode // Include discount code in response for debugging
    });

  } catch (error) {
    console.error('Error in register-user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle GET requests for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userFid = parseInt(searchParams.get('userFid')) || 466111;
  
  return NextResponse.json({
    message: 'User registration endpoint',
    usage: 'POST with { userFid, userData, notificationToken }',
    testUserFid: userFid,
    timestamp: new Date().toISOString()
  });
} 