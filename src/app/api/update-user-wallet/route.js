import { NextResponse } from 'next/server';
import { setUserContext } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchUserWalletData } from '@/lib/walletUtils';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

export async function POST(request) {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // 🔒 SECURITY FIX: Verify JWT authentication before setting user context
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    console.log('🔄 Authenticated user updating wallet data for FID:', fid);

    // Set user context for RLS policies (after JWT verification)
    await setUserContext(fid);

    // Fetch fresh wallet data from Neynar
    const walletData = await fetchUserWalletData(fid);
    if (!walletData) {
      return NextResponse.json({ 
        error: 'Could not fetch wallet data from Neynar',
        fid 
      }, { status: 404 });
    }

    // Update user profile with wallet data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({
        custody_address: walletData.custody_address,
        verified_eth_addresses: walletData.verified_eth_addresses,
        verified_sol_addresses: walletData.verified_sol_addresses,
        primary_eth_address: walletData.primary_eth_address,
        primary_sol_address: walletData.primary_sol_address,
        all_wallet_addresses: walletData.all_wallet_addresses,
        wallet_data_updated_at: walletData.wallet_data_updated_at,
        updated_at: new Date().toISOString()
      })
      .eq('fid', fid)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating user wallet data:', profileError);
      return NextResponse.json({ 
        error: 'Failed to update user wallet data',
        details: profileError 
      }, { status: 500 });
    }

    console.log('✅ Wallet data updated successfully for FID:', fid);

    return NextResponse.json({ 
      success: true, 
      fid,
      profile,
      walletAddressCount: walletData.all_wallet_addresses?.length || 0,
      walletData: {
        custody_address: walletData.custody_address,
        eth_addresses_count: walletData.verified_eth_addresses?.length || 0,
        sol_addresses_count: walletData.verified_sol_addresses?.length || 0,
        primary_eth: walletData.primary_eth_address,
        primary_sol: walletData.primary_sol_address
      }
    });

  } catch (error) {
    console.error('Error in update-user-wallet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle GET requests for testing and batch updates
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetFid = searchParams.get('fid');
    const batchUpdate = searchParams.get('batch') === 'true';
    const limit = parseInt(searchParams.get('limit')) || 10;

    if (targetFid) {
      // Single user update
      console.log('🔄 GET request to update wallet data for FID:', targetFid);
      
      // 🔒 SECURITY FIX: Verify JWT authentication before accessing wallet data
      const authenticatedFid = await getAuthenticatedFid(request);
      const authCheck = requireOwnFid(authenticatedFid, targetFid);
      if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails
      
      // Set user context for RLS policies (after JWT verification)
      await setUserContext(targetFid);
      
      const walletData = await fetchUserWalletData(parseInt(targetFid));
      if (!walletData) {
        return NextResponse.json({ 
          error: 'Could not fetch wallet data',
          fid: targetFid 
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        fid: targetFid,
        message: 'Use POST method to actually update the database',
        walletData,
        previewUpdate: {
          custody_address: walletData.custody_address,
          total_addresses: walletData.all_wallet_addresses?.length || 0
        }
      });
    }

    if (batchUpdate) {
      // Batch update for existing users without wallet data
      console.log('🔄 Batch wallet data update requested...');
      
      const { data: usersWithoutWallets, error } = await supabase
        .from('profiles')
        .select('fid, username, display_name')
        .is('wallet_data_updated_at', null)
        .limit(limit);

      if (error) {
        return NextResponse.json({ 
          error: 'Failed to fetch users without wallet data',
          details: error 
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Users found without wallet data',
        usersCount: usersWithoutWallets?.length || 0,
        users: usersWithoutWallets,
        instructions: 'Use POST /api/update-user-wallet with each FID to update wallet data'
      });
    }

    // Default info response
    return NextResponse.json({
      message: 'Update user wallet data endpoint',
      usage: {
        single_update: 'POST with { fid: number }',
        preview_single: 'GET with ?fid=number',
        list_users_without_wallets: 'GET with ?batch=true&limit=10'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in update-user-wallet GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 