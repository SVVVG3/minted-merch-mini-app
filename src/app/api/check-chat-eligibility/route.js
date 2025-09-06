import { NextResponse } from 'next/server';
import { checkChatEligibility, generateChatInvitation } from '@/lib/chatEligibility';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }

    console.log('🎫 Checking chat eligibility for popup, FID:', fid);

    // Step 1: Get user's wallet addresses from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, custody_address, verified_eth_addresses, all_wallet_addresses')
      .eq('fid', fid)
      .single();

    if (profileError || !profile) {
      console.log('❌ No profile found for FID:', fid);
      return NextResponse.json({
        success: true,
        shouldShowInvite: false,
        reason: 'No profile found'
      });
    }

    // Step 2: Extract wallet addresses
    const walletAddresses = [];
    
    if (profile.custody_address) {
      walletAddresses.push(profile.custody_address);
    }
    
    if (profile.verified_eth_addresses && Array.isArray(profile.verified_eth_addresses)) {
      walletAddresses.push(...profile.verified_eth_addresses);
    }
    
    if (profile.all_wallet_addresses && Array.isArray(profile.all_wallet_addresses)) {
      walletAddresses.push(...profile.all_wallet_addresses);
    }

    // Filter valid ETH addresses
    const validWallets = [...new Set(walletAddresses)]
      .filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42);

    if (validWallets.length === 0) {
      console.log('❌ No valid wallet addresses for FID:', fid);
      return NextResponse.json({
        success: true,
        shouldShowInvite: false,
        reason: 'No valid wallet addresses'
      });
    }

    console.log(`💰 Found ${validWallets.length} wallet addresses for FID ${fid}`);

    // Step 3: Check token eligibility (and update cache)
    const eligibility = await checkChatEligibility(validWallets, fid);

    if (!eligibility.eligible) {
      console.log('❌ User not eligible for chat:', eligibility.message);
      return NextResponse.json({
        success: true,
        shouldShowInvite: false,
        reason: 'Not eligible - insufficient tokens',
        tokenBalance: eligibility.tokenBalance
      });
    }

    console.log('✅ User is eligible for chat!');

    // Step 4: Check if already a chat member
    const { data: existingMember, error: memberError } = await supabaseAdmin
      .from('chat_members')
      .select('fid, is_active, removed_at')
      .eq('fid', fid)
      .single();

    // If user is already an active member, don't show popup
    if (existingMember && existingMember.is_active) {
      console.log('✅ User is already an active chat member');
      return NextResponse.json({
        success: true,
        shouldShowInvite: false,
        reason: 'Already active member'
      });
    }

    // If user was removed but is now eligible again, show popup
    const wasRemoved = existingMember && !existingMember.is_active;
    if (wasRemoved) {
      console.log('🔄 User was previously removed but is now eligible again');
    }

    // Step 5: Generate invitation (pass existing eligibility to avoid re-checking)
    const invitation = await generateChatInvitation(fid, validWallets, eligibility);

    if (!invitation.success) {
      console.error('❌ Failed to generate invitation:', invitation.message);
      return NextResponse.json({
        success: false,
        error: 'Failed to generate invitation'
      });
    }

    console.log('🎉 Generated chat invitation for eligible user');

    return NextResponse.json({
      success: true,
      shouldShowInvite: true,
      tokenBalance: eligibility.tokenBalance,
      inviteLink: invitation.groupInviteLink,
      inviteToken: invitation.invitationToken,
      wasRemoved,
      username: profile.username
    });

  } catch (error) {
    console.error('❌ Error checking chat eligibility for popup:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
