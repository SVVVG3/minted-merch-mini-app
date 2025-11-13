// Admin API - Ambassador Management
// GET: List all ambassadors with stats
// POST: Add new ambassador

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendWelcomeAmbassadorNotification } from '@/lib/ambassadorNotifications';

// GET /api/admin/ambassadors - List all ambassadors
export const GET = withAdminAuth(async (request) => {
  try {
    console.log('📋 Admin fetching all ambassadors...');

    const { data: ambassadors, error } = await supabaseAdmin
      .from('ambassadors')
      .select(`
        *,
        profiles (
          fid,
          username,
          display_name,
          pfp_url,
          primary_eth_address,
          verified_eth_addresses,
          custody_address,
          all_wallet_addresses
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching ambassadors:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch ambassadors'
      }, { status: 500 });
    }

    console.log(`✅ Fetched ${ambassadors.length} ambassadors`);

    return NextResponse.json({
      success: true,
      ambassadors
    });

  } catch (error) {
    console.error('❌ Error in GET /api/admin/ambassadors:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

// POST /api/admin/ambassadors - Add new ambassador
export const POST = withAdminAuth(async (request) => {
  try {
    const { fid, notes } = await request.json();

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    console.log(`➕ Admin adding new ambassador with FID ${fid}...`);

    // Check if profile exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name')
      .eq('fid', fid)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile not found for FID:', fid);
      return NextResponse.json({
        success: false,
        error: `No profile found for FID ${fid}. User must sign in first.`
      }, { status: 404 });
    }

    // Check if already an ambassador
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('ambassadors')
      .select('id, is_active')
      .eq('fid', fid)
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: `User @${profile.username} is already an ambassador${
          existing.is_active ? '' : ' (inactive)'
        }`
      }, { status: 409 });
    }

    // Create ambassador
    const { data: ambassador, error: insertError } = await supabaseAdmin
      .from('ambassadors')
      .insert({
        fid,
        is_active: true,
        notes: notes || null,
        total_earned_tokens: 0,
        total_bounties_completed: 0
      })
      .select(`
        *,
        profiles (
          fid,
          username,
          display_name,
          pfp_url
        )
      `)
      .single();

    if (insertError) {
      console.error('❌ Error creating ambassador:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create ambassador'
      }, { status: 500 });
    }

    console.log(`✅ Ambassador created: @${profile.username} (FID ${fid})`);

    // Send welcome notification to new ambassador (don't fail if notification fails)
    try {
      const notificationResult = await sendWelcomeAmbassadorNotification(fid, ambassador);
      if (notificationResult.success) {
        console.log(`📬 Welcome notification sent to @${profile.username} (FID: ${fid})`);
      } else if (notificationResult.skipped) {
        console.log(`⏭️ Welcome notification skipped for FID ${fid}: ${notificationResult.reason}`);
      } else {
        console.error('⚠️ Failed to send welcome notification:', notificationResult.error);
      }
    } catch (notificationError) {
      console.error('⚠️ Error sending welcome notification (continuing anyway):', notificationError);
    }

    return NextResponse.json({
      success: true,
      ambassador
    });

  } catch (error) {
    console.error('❌ Error in POST /api/admin/ambassadors:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

