import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { fid, inviteToken } = await request.json();

    if (!fid || !inviteToken) {
      return NextResponse.json({
        success: false,
        error: 'FID and invite token are required'
      }, { status: 400 });
    }

    console.log('📊 Tracking chat invite click for FID:', fid);

    // Update the invitation record to mark as clicked
    const { error: updateError } = await supabaseAdmin
      .from('chat_invitations')
      .update({ 
        clicked_at: new Date().toISOString() 
      })
      .eq('fid', fid)
      .eq('invitation_token', inviteToken);

    if (updateError) {
      console.error('❌ Error updating invitation click:', updateError);
      // Don't fail the request if tracking fails
    }

    // Also add the user to chat_members if they're not already there
    // This ensures they're tracked even if they don't complete the join process
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, pfp_url')
      .eq('fid', fid)
      .single();

    if (!profileError && profile) {
      const { error: upsertError } = await supabaseAdmin
        .from('chat_members')
        .upsert({
          fid: profile.fid,
          username: profile.username,
          display_name: profile.display_name,
          pfp_url: profile.pfp_url,
          wallet_addresses: [], // Will be populated from profiles when needed
          added_at: new Date().toISOString(),
          is_active: true,
          removed_at: null
        }, {
          onConflict: 'fid',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('❌ Error adding user to chat members:', upsertError);
      } else {
        console.log('✅ Added user to chat members on invite click');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Invite click tracked successfully'
    });

  } catch (error) {
    console.error('❌ Error tracking chat invite click:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
