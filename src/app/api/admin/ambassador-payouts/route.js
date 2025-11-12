// Admin API - Ambassador Payouts Management
// GET: List all payouts
// PUT: Update payout status (mark as completed with tx hash)

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/admin/ambassador-payouts - List all payouts
export const GET = withAdminAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, processing, completed, failed
    const ambassadorId = searchParams.get('ambassadorId');

    console.log('📋 Admin fetching payouts...', { status, ambassadorId });

    let query = supabaseAdmin
      .from('ambassador_payouts')
      .select(`
        *,
        ambassadors!ambassador_payouts_ambassador_id_fkey (
          id,
          fid,
          profiles (
            username,
            display_name,
            pfp_url
          )
        ),
        bounty_submissions (
          id,
          proof_url,
          bounties (
            title
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (ambassadorId) {
      query = query.eq('ambassador_id', ambassadorId);
    }

    const { data: payouts, error } = await query;

    if (error) {
      console.error('❌ Error fetching payouts:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch payouts'
      }, { status: 500 });
    }

    console.log(`✅ Fetched ${payouts.length} payouts`);

    // Calculate total amounts by status
    const summary = payouts.reduce((acc, payout) => {
      const status = payout.status;
      if (!acc[status]) {
        acc[status] = { count: 0, total: 0 };
      }
      acc[status].count++;
      acc[status].total += payout.amount_tokens;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      payouts,
      summary
    });

  } catch (error) {
    console.error('❌ Error in GET /api/admin/ambassador-payouts:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

// PUT /api/admin/ambassador-payouts - Update payout (mark as completed, add tx hash)
export const PUT = withAdminAuth(async (request) => {
  try {
    const { payoutId, status, transactionHash, notes } = await request.json();
    const adminFid = request.adminAuth?.fid;

    if (!payoutId) {
      return NextResponse.json({
        success: false,
        error: 'Payout ID is required'
      }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({
        success: false,
        error: 'Status is required'
      }, { status: 400 });
    }

    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 });
    }

    console.log(`💰 Admin updating payout ${payoutId} to ${status}...`);

    const updateData = {
      status,
      processed_by_admin_fid: adminFid || null
    };

    if (transactionHash) {
      updateData.transaction_hash = transactionHash;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: payout, error } = await supabaseAdmin
      .from('ambassador_payouts')
      .update(updateData)
      .eq('id', payoutId)
      .select(`
        *,
        ambassadors!ambassador_payouts_ambassador_id_fkey (
          id,
          fid,
          profiles (
            username,
            display_name
          )
        )
      `)
      .single();

    if (error) {
      console.error('❌ Error updating payout:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update payout'
      }, { status: 500 });
    }

    if (!payout) {
      return NextResponse.json({
        success: false,
        error: 'Payout not found'
      }, { status: 404 });
    }

    console.log(`✅ Payout updated to ${status}`);
    if (transactionHash) {
      console.log(`🔗 Transaction hash: ${transactionHash}`);
    }

    return NextResponse.json({
      success: true,
      payout
    });

  } catch (error) {
    console.error('❌ Error in PUT /api/admin/ambassador-payouts:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

