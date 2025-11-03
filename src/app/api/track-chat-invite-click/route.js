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
      .select('fid, username, display_name, pfp_url, custody_address, verified_eth_addresses, all_wallet_addresses')
      .eq('fid', fid)
      .single();

    if (!profileError && profile) {
      // Extract wallet addresses from profile data (same logic as addChatMembersByFids)
      const walletAddresses = [];
      
      // Add custody address
      if (profile.custody_address) {
        walletAddresses.push(profile.custody_address);
      }
      
      // Add verified ETH addresses
      if (profile.verified_eth_addresses && Array.isArray(profile.verified_eth_addresses)) {
        walletAddresses.push(...profile.verified_eth_addresses);
      }
      
      // Add all wallet addresses
      if (profile.all_wallet_addresses && Array.isArray(profile.all_wallet_addresses)) {
        walletAddresses.push(...profile.all_wallet_addresses);
      }

      // Filter out duplicates and keep only valid ETH addresses
      const uniqueWallets = [...new Set(walletAddresses)]
        .filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42);

      console.log(`💰 Adding user to chat_members with ${uniqueWallets.length} wallet addresses`);

      // DON'T mark as is_active=true yet! User hasn't actually joined the group.
      // Only track that they clicked the invite. Admin will manually verify and activate them.
      const { error: upsertError } = await supabaseAdmin
        .from('chat_members')
        .upsert({
          fid: profile.fid,
          username: profile.username,
          display_name: profile.display_name,
          pfp_url: profile.pfp_url,
          wallet_addresses: uniqueWallets,
          added_at: new Date().toISOString(),
          is_active: false, // NOT active until admin verifies they're actually in the group
          removed_at: null
        }, {
          onConflict: 'fid',
          ignoreDuplicates: true // Don't overwrite existing members who are already active
        });

      if (upsertError) {
        console.error('❌ Error tracking invite click in chat members:', upsertError);
      } else {
        console.log('✅ Tracked invite click - user marked as pending (not active yet)');
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
