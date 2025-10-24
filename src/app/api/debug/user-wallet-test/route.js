import { NextResponse } from 'next/server';
import { neynarClient, isNeynarAvailable } from '@/lib/neynar';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid') || '466111'; // Default to your FID

    console.log('🔍 Testing user wallet data fetch for FID:', fid);

    if (!isNeynarAvailable()) {
      return NextResponse.json({
        error: 'Neynar not available',
        message: 'NEYNAR_API_KEY not configured'
      }, { status: 500 });
    }

    // Test user lookup with Neynar
    console.log('Testing user lookup with Neynar...');
    const userResponse = await neynarClient.fetchBulkUsers({
      fids: [parseInt(fid)]
    });
    console.log('User data from Neynar:', JSON.stringify(userResponse, null, 2));

    // Extract wallet-related information
    const userData = userResponse.users[0];
    const walletData = {
      fid: userData.fid,
      username: userData.username,
      display_name: userData.display_name,
      custody_address: userData.custody_address, // Main custody wallet
      verifications: userData.verifications || [], // Legacy format
      verified_addresses: userData.verified_addresses || {}, // New format with eth and sol
      all_wallet_addresses: []
    };

    // Combine all wallet addresses into a single array
    const allAddresses = new Set();
    
    // Add custody address
    if (userData.custody_address) {
      allAddresses.add(userData.custody_address.toLowerCase());
    }

    // Add legacy verifications
    if (userData.verifications) {
      userData.verifications.forEach(addr => allAddresses.add(addr.toLowerCase()));
    }

    // Add verified addresses (new format)
    if (userData.verified_addresses) {
      if (userData.verified_addresses.eth_addresses) {
        userData.verified_addresses.eth_addresses.forEach(addr => allAddresses.add(addr.toLowerCase()));
      }
      if (userData.verified_addresses.sol_addresses) {
        userData.verified_addresses.sol_addresses.forEach(addr => allAddresses.add(addr.toLowerCase()));
      }
    }

    walletData.all_wallet_addresses = Array.from(allAddresses);

    console.log('💰 Extracted wallet data:', walletData);

    return NextResponse.json({
      success: true,
      message: `Found ${walletData.all_wallet_addresses.length} wallet addresses for ${userData.username}`,
      fid: parseInt(fid),
      wallet_data: walletData,
      token_gating_ready: walletData.all_wallet_addresses.length > 0,
      raw_neynar_response: userData // Full response for debugging
    });

  } catch (error) {
    console.error('❌ Error fetching user wallet data:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    console.log('🔍 POST request - Testing wallet data for FID:', fid);

    if (!isNeynarAvailable()) {
      return NextResponse.json({
        error: 'Neynar not available'
      }, { status: 500 });
    }

    // Get user data from Neynar if available
    console.log('Getting user data from Neynar...');
    const userResponse = await neynarClient.fetchBulkUsers({
      fids: [fid]
    });
    const userData = userResponse.users[0];

    // Extract just the wallet addresses for token-gating
    const walletAddresses = {
      custody_address: userData.custody_address,
      verified_eth_addresses: userData.verified_addresses?.eth_addresses || [],
      verified_sol_addresses: userData.verified_addresses?.sol_addresses || [],
      legacy_verifications: userData.verifications || []
    };

    // Create combined list for easy token-gating queries
    const allAddresses = new Set();
    if (userData.custody_address) allAddresses.add(userData.custody_address.toLowerCase());
    userData.verifications?.forEach(addr => allAddresses.add(addr.toLowerCase()));
    userData.verified_addresses?.eth_addresses?.forEach(addr => allAddresses.add(addr.toLowerCase()));
    // Note: For token-gating, we'll primarily focus on ETH addresses initially

    return NextResponse.json({
      success: true,
      fid,
      wallet_addresses: walletAddresses,
      combined_eth_addresses: Array.from(allAddresses),
      token_gating_summary: {
        total_addresses: allAddresses.size,
        has_custody: !!userData.custody_address,
        has_verified_eth: (userData.verified_addresses?.eth_addresses?.length || 0) > 0,
        has_verified_sol: (userData.verified_addresses?.sol_addresses?.length || 0) > 0,
        ready_for_token_gating: allAddresses.size > 0
      }
    });

  } catch (error) {
    console.error('❌ Error in POST wallet test:', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
});