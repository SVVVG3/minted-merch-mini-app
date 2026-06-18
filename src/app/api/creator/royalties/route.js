/**
 * GET /api/creator/royalties
 * Returns all royalties for the authenticated creator, grouped by status.
 * SECURITY: Requires JWT auth + Merch Mogul status (50M+ staked)
 */

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const MERCH_MOGUL_THRESHOLD = 50_000_000;

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authResult = await verifyFarcasterUser(token);
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const fid = authResult.fid;
    const supabase = getSupabaseAdmin();

    // Verify creator is a Merch Mogul
    const { data: profile } = await supabase
      .from('profiles')
      .select('staked_balance, primary_eth_address')
      .eq('fid', fid)
      .single();

    const stakedBalance = Number(profile?.staked_balance || 0);
    if (stakedBalance < MERCH_MOGUL_THRESHOLD) {
      return NextResponse.json({
        success: false,
        error: 'Merch Mogul status required (50M+ $mintedmerch staked)',
        stakedBalance,
      }, { status: 403 });
    }

    const { data: royalties, error } = await supabase
      .from('creator_royalties')
      .select('id, mintedmerch_amount, status, created_at, settled_at, transaction_hash, buyer_fid, design_order_request_id')
      .eq('creator_fid', fid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching creator royalties:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch royalties' }, { status: 500 });
    }

    const pending   = royalties.filter(r => r.status === 'pending');
    const settled   = royalties.filter(r => r.status === 'settled');
    const totalPending  = pending.reduce((s, r) => s + (r.mintedmerch_amount || 0), 0);
    const totalSettled  = settled.reduce((s, r) => s + (r.mintedmerch_amount || 0), 0);

    return NextResponse.json({
      success: true,
      royalties,
      stats: {
        total: royalties.length,
        pendingCount: pending.length,
        settledCount: settled.length,
        totalPending,
        totalSettled,
      },
      walletAddress: profile?.primary_eth_address || null,
    });
  } catch (err) {
    console.error('❌ /api/creator/royalties GET:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
