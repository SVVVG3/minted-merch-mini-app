// Admin API - Regenerate Claim Signature for Stuck Payouts
// POST: Regenerate signature with new UID for payouts that are failing to claim

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateClaimSignature, getDefaultClaimDeadline } from '@/lib/claimSignatureService';

export const POST = withAdminAuth(async (request) => {
  try {
    const { payoutId } = await request.json();
    
    if (!payoutId) {
      return NextResponse.json({ 
        success: false, 
        error: 'payoutId is required' 
      }, { status: 400 });
    }
    
    console.log(`🔧 Admin: Regenerating signature for payout ${payoutId}`);
    
    // Get the payout
    const { data: payout, error: fetchError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select('*')
      .eq('id', payoutId)
      .single();
    
    if (fetchError || !payout) {
      return NextResponse.json({ 
        success: false, 
        error: 'Payout not found' 
      }, { status: 404 });
    }
    
    if (payout.status !== 'claimable') {
      return NextResponse.json({ 
        success: false, 
        error: `Payout status is '${payout.status}', can only regenerate 'claimable' payouts` 
      }, { status: 400 });
    }
    
    if (!payout.wallet_address) {
      return NextResponse.json({ 
        success: false, 
        error: 'Payout has no wallet address' 
      }, { status: 400 });
    }
    
    // Generate NEW signature with NEW UID
    // Use a new unique identifier to ensure fresh UID
    const newPayoutId = `${payoutId}-regen-${Date.now()}`;
    const deadline = getDefaultClaimDeadline();
    const amountWei = BigInt(payout.amount_tokens) * BigInt(10 ** 18);
    
    console.log(`🔧 Generating new signature for:`, {
      wallet: payout.wallet_address,
      amount: payout.amount_tokens,
      amountWei: amountWei.toString(),
      newPayoutId
    });
    
    const { req, signature } = await generateClaimSignature({
      wallet: payout.wallet_address,
      amount: amountWei.toString(),
      payoutId: newPayoutId,
      deadline
    });
    
    // Convert BigInt values to strings for JSON serialization
    const serializableReq = {
      ...req,
      expirationTimestamp: req.expirationTimestamp?.toString(),
      contents: req.contents?.map(c => ({
        ...c,
        amount: c.amount?.toString()
      }))
    };
    
    // Store the new signature
    const newClaimData = JSON.stringify({ req: serializableReq, signature });
    
    const { error: updateError } = await supabaseAdmin
      .from('ambassador_payouts')
      .update({
        claim_signature: newClaimData,
        claim_deadline: deadline.toISOString()
      })
      .eq('id', payoutId);
    
    if (updateError) {
      console.error(`❌ Failed to update payout ${payoutId}:`, updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update payout' 
      }, { status: 500 });
    }
    
    console.log(`✅ Successfully regenerated signature for payout ${payoutId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Signature regenerated successfully',
      payoutId,
      newUid: req.uid,
      newDeadline: deadline.toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error regenerating payout signature:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});

