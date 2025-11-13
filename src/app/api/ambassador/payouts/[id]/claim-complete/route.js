// Ambassador API - Mark Payout as Claimed
// POST: Updates payout status after successful on-chain claim

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { checkAmbassadorStatus } from '@/lib/ambassadorHelpers';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    
    // 1. Authenticate ambassador
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
    
    // 2. Check if user is an active ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(userFid);
    
    if (!isAmbassador || !ambassadorId) {
      return NextResponse.json({ 
        success: false,
        error: 'User is not an active ambassador' 
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
    
    console.log(`✅ Marking payout ${id} as completed with TX: ${transactionHash}`);
    
    // 4. Verify payout belongs to this ambassador
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select('id, ambassador_id, status, amount_tokens')
      .eq('id', id)
      .eq('ambassador_id', ambassadorId)
      .single();
    
    if (payoutError || !payout) {
      console.error(`❌ Payout not found or access denied: ${id}`);
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
        claim_transaction_hash: transactionHash,
        claimed_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) {
      console.error(`❌ Error updating payout:`, updateError);
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
      console.error('⚠️ Error logging claim event:', logError);
      // Continue anyway - main operation succeeded
    }
    
    console.log(`✅ Payout ${id} marked as completed - ${payout.amount_tokens} tokens claimed`);
    
    return NextResponse.json({
      success: true,
      message: 'Payout marked as completed',
      transactionHash
    });
    
  } catch (error) {
    console.error('❌ Error in POST /api/ambassador/payouts/[id]/claim-complete:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update payout status' 
    }, { status: 500 });
  }
}

