import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Update a user's connected wallet address in their profile
 * This is for dGEN1/desktop users who connect via Web3Modal/window.ethereum
 * Different from Farcaster verified addresses (those come from Neynar)
 */
export async function POST(request) {
  try {
    const { fid, walletAddress } = await request.json();

    if (!fid || !walletAddress) {
      return NextResponse.json({ 
        error: 'FID and wallet address are required' 
      }, { status: 400 });
    }

    // Normalize wallet address to lowercase for consistency
    const normalizedAddress = walletAddress.toLowerCase();

    console.log('💳 Updating connected wallet for FID:', fid, 'Address:', normalizedAddress);

    // Update profile with the connected wallet
    // We'll store it in primary_eth_address if they don't have one from Farcaster
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('primary_eth_address, verified_eth_addresses, all_wallet_addresses')
      .eq('fid', fid)
      .single();

    if (fetchError) {
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

    // If they don't have a primary ETH address from Farcaster, use this one
    if (!existingProfile.primary_eth_address) {
      updates.primary_eth_address = normalizedAddress;
    }

    // Add to verified_eth_addresses if not already there
    const verifiedAddresses = existingProfile.verified_eth_addresses || [];
    if (!verifiedAddresses.includes(normalizedAddress)) {
      updates.verified_eth_addresses = [...verifiedAddresses, normalizedAddress];
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

