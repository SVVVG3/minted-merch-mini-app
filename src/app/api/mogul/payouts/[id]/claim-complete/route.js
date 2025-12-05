// Mogul API - Mark Payout as Claimed
// POST: Updates payout status after successful on-chain claim
// SECURITY: Requires JWT auth + mogul status + ownership via bounty_submissions.ambassador_fid

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { checkMogulStatus } from '@/lib/mogulHelpers';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    
    // 1. Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const authResult = await verifyFarcasterUser(token);
    
    if (!authResult.authenticated) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid authentication token' 
      }, { status: 401 });
    }
    
    const userFid = authResult.fid;
    
    // 2. Check if user is a Merch Mogul
    const { isMogul, tokenBalance } = await checkMogulStatus(userFid);
    
    if (!isMogul) {
      return NextResponse.json({ 
        success: false,
        error: 'Merch Mogul status required (50M+ $mintedmerch tokens)',
        tokenBalance,
        requiredBalance: 50_000_000
      }, { status: 403 });
    }
    
    // 3. Get transaction hash from request body
    const body = await request.json();
    const { transactionHash } = body;
    
    if (!transactionHash) {
      return NextResponse.json({ 
        success: false,
        error: 'Transaction hash is required' 
      }, { status: 400 });
    }
    
    console.log(`✅ Marking mogul payout ${id} as completed with TX: ${transactionHash}`);
    
    // 4. Verify payout belongs to this mogul via bounty_submissions.ambassador_fid
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select(`
        id, 
        ambassador_id, 
        status, 
        amount_tokens,
        wallet_address,
        bounty_submissions!inner(
          ambassador_fid
        )
      `)
      .eq('id', id)
      .is('ambassador_id', null) // Mogul payouts have NULL ambassador_id
      .eq('bounty_submissions.ambassador_fid', userFid)
      .single();
    
    if (payoutError || !payout) {
      console.error(`❌ Mogul payout not found or access denied: ${id} for FID ${userFid}`, payoutError);
      return NextResponse.json({ 
        success: false,
        error: 'Payout not found' 
      }, { status: 404 });
    }
    
    // 5. Update payout status to completed
    const { error: updateError } = await supabaseAdmin
      .from('ambassador_payouts')
      .update({
        status: 'completed',
        transaction_hash: transactionHash,
        claimed_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) {
      console.error(`❌ Error updating mogul payout:`, updateError);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to update payout status' 
      }, { status: 500 });
    }
    
    // 6. Log successful claim event
    try {
      await supabaseAdmin.from('payout_claim_events').insert({
        payout_id: id,
        user_fid: userFid,
        wallet_address: payout.wallet_address,
        transaction_hash: transactionHash,
        status: 'success',
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
      });
    } catch (logError) {
      console.error('⚠️ Error logging mogul claim event:', logError);
      // Continue anyway - main operation succeeded
    }
    
    console.log(`✅ Mogul payout ${id} marked as completed - ${payout.amount_tokens} tokens claimed by FID ${userFid}`);
    
    return NextResponse.json({
      success: true,
      message: 'Payout marked as completed',
      transactionHash
    });
    
  } catch (error) {
    console.error('❌ Error in POST /api/mogul/payouts/[id]/claim-complete:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update payout status' 
    }, { status: 500 });
  }
}

