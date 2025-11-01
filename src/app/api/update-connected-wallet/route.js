import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

/**
 * Update a user's connected wallet address in their profile
 * This is for dGEN1/desktop users who connect via Web3Modal/window.ethereum
 * Different from Farcaster verified addresses (those come from Neynar)
 * Stores in connected_eth_addresses for proper labeling in Admin Dashboard
 */
export async function POST(request) {
  try {
    const { fid, walletAddress } = await request.json();

    if (!fid || !walletAddress) {
      return NextResponse.json({ 
        error: 'FID and wallet address are required' 
      }, { status: 400 });
    }

    // SECURITY FIX: Verify user can only update their own connected wallet
    // Prevents wallet spoofing attacks (e.g., associating Uniswap contract to appear #1 on leaderboard)
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Return 401 or 403 error

    // Validate wallet address - reject invalid addresses like "decline"
    if (walletAddress.toLowerCase() === 'decline' || 
        walletAddress.toLowerCase() === 'undefined' ||
        walletAddress.toLowerCase() === 'null' ||
        walletAddress.toLowerCase() === 'error' ||
        !walletAddress.startsWith('0x') ||
        walletAddress.length !== 42) {
      console.log('❌ Invalid wallet address rejected:', walletAddress);
      return NextResponse.json({ 
        error: 'Invalid wallet address',
        details: 'Wallet connection was declined or failed'
      }, { status: 400 });
    }

    // Normalize wallet address to lowercase for consistency
    const normalizedAddress = walletAddress.toLowerCase();

    console.log('💳 Updating connected wallet for FID:', fid, 'Address:', normalizedAddress);

    // Get existing profile
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('connected_eth_addresses, all_wallet_addresses')
      .eq('fid', fid)
      .single();

    if (fetchError) {
      // PGRST116 means profile doesn't exist - this is expected for new users
      if (fetchError.code === 'PGRST116') {
        console.log(`ℹ️ Profile not found for FID ${fid} - user needs to register first`);
        return NextResponse.json({ 
          error: 'Profile not found',
          details: 'User must sign in with Farcaster first to create a profile',
          code: 'PROFILE_NOT_FOUND'
        }, { status: 404 });
      }
      
      // Other errors are actual database issues
      console.error('Error fetching existing profile:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch profile',
        details: fetchError 
      }, { status: 500 });
    }

    // Prepare updated wallet data
    const updates = {
      updated_at: new Date().toISOString()
    };

    // Add to connected_eth_addresses if not already there
    const connectedAddresses = existingProfile.connected_eth_addresses || [];
    if (!connectedAddresses.includes(normalizedAddress)) {
      updates.connected_eth_addresses = [...connectedAddresses, normalizedAddress];
      console.log(`💳 Adding new connected wallet: ${normalizedAddress}`);
    } else {
      console.log(`💳 Wallet already connected: ${normalizedAddress}`);
    }

    // Add to all_wallet_addresses if not already there
    const allAddresses = existingProfile.all_wallet_addresses || [];
    if (!allAddresses.includes(normalizedAddress)) {
      updates.all_wallet_addresses = [...allAddresses, normalizedAddress];
    }

    // Update last connected timestamp
    updates.wallet_data_updated_at = new Date().toISOString();

    // Update the profile
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('fid', fid)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating connected wallet:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update wallet',
        details: updateError 
      }, { status: 500 });
    }

    console.log('✅ Connected wallet updated successfully for FID:', fid);

    return NextResponse.json({ 
      success: true,
      fid,
      walletAddress: normalizedAddress,
      profile: updatedProfile
    });

  } catch (error) {
    console.error('Error in update-connected-wallet API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

