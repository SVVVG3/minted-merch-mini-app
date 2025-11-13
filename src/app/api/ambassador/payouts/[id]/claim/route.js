// Ambassador API - Claim Payout (Backend-Executed via Thirdweb API)
// POST: Executes airdrop transaction via Thirdweb API

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
    console.log(`💰 Processing claim for payout ${id} (FID: ${userFid})`);
    
    // 2. Check if user is an active ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(userFid);
    
    if (!isAmbassador || !ambassadorId) {
      return NextResponse.json({ 
        success: false,
        error: 'User is not an active ambassador' 
      }, { status: 403 });
    }
    
    // 3. Get payout with ownership verification
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select('*')
      .eq('id', id)
      .eq('ambassador_id', ambassadorId)
      .single();
    
    if (payoutError || !payout) {
      console.error(`❌ Payout not found: ${id}`);
      return NextResponse.json({ 
        success: false,
        error: 'Payout not found or access denied' 
      }, { status: 404 });
    }
    
    // 4. Validate payout is claimable
    if (payout.status !== 'claimable') {
      return NextResponse.json({ 
        success: false,
        error: 'Payout is not claimable',
        currentStatus: payout.status
      }, { status: 400 });
    }
    
    // 5. Validate wallet address exists
    if (!payout.wallet_address) {
      return NextResponse.json({ 
        success: false,
        error: 'No wallet address configured' 
      }, { status: 400 });
    }
    
    // 6. Execute airdrop via Thirdweb API
    const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
    const AIRDROP_CONTRACT_ADDRESS = process.env.AIRDROP_CONTRACT_ADDRESS;
    const TOKEN_ADDRESS = process.env.MINTEDMERCH_TOKEN_ADDRESS;
    const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS;
    
    if (!THIRDWEB_SECRET_KEY) {
      console.error('❌ THIRDWEB_SECRET_KEY not configured');
      return NextResponse.json({ 
        success: false,
        error: 'Service configuration error' 
      }, { status: 500 });
    }
    
    console.log(`🚀 Executing airdrop via Thirdweb API...`, {
      contract: AIRDROP_CONTRACT_ADDRESS,
      recipient: payout.wallet_address,
      amount: payout.amount_tokens.toString()
    });
    
    // Update status to processing
    await supabaseAdmin
      .from('ambassador_payouts')
      .update({ status: 'processing' })
      .eq('id', id);
    
    try {
      // Call Thirdweb API to execute airdrop
      const response = await fetch('https://api.thirdweb.com/v1/contracts/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-secret-key': THIRDWEB_SECRET_KEY,
        },
        body: JSON.stringify({
          calls: [
            {
              contractAddress: AIRDROP_CONTRACT_ADDRESS,
              method: 'function airdropERC20(address _tokenAddress, (address recipient, uint256 amount)[] _contents)',
              params: [
                TOKEN_ADDRESS,
                [
                  {
                    recipient: payout.wallet_address,
                    amount: payout.amount_tokens.toString()
                  }
                ]
              ],
            },
          ],
          chainId: 8453, // Base
          from: ADMIN_WALLET_ADDRESS,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.result?.transactionIds?.[0]) {
        console.error('❌ Thirdweb API error:', data);
        throw new Error(data.error?.message || 'Thirdweb API request failed');
      }
      
      const transactionId = data.result.transactionIds[0];
      console.log(`✅ Airdrop executed! Transaction ID: ${transactionId}`);
      
      // 7. Update payout status to completed
      const { error: updateError } = await supabaseAdmin
        .from('ambassador_payouts')
        .update({
          status: 'completed',
          claim_transaction_hash: transactionId,
          claimed_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (updateError) {
        console.error('⚠️ Error updating payout status:', updateError);
      }
      
      // 8. Log successful claim event
      try {
        await supabaseAdmin.from('payout_claim_events').insert({
          payout_id: id,
          user_fid: userFid,
          wallet_address: payout.wallet_address,
          transaction_hash: transactionId,
          status: 'success',
          ip_address: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
        });
      } catch (logError) {
        console.error('⚠️ Error logging claim event:', logError);
      }
      
      console.log(`✅ Payout ${id} completed - ${payout.amount_tokens} tokens claimed`);
      
      return NextResponse.json({
        success: true,
        message: 'Tokens claimed successfully!',
        transactionId,
        amount: payout.amount_tokens,
        explorerUrl: `https://basescan.org/tx/${transactionId}`
      });
      
    } catch (apiError) {
      console.error('❌ Airdrop execution failed:', apiError);
      
      // Rollback to claimable status
      await supabaseAdmin
        .from('ambassador_payouts')
        .update({ status: 'claimable' })
        .eq('id', id);
      
      // Log failed attempt
      try {
        await supabaseAdmin.from('payout_claim_events').insert({
          payout_id: id,
          user_fid: userFid,
          wallet_address: payout.wallet_address,
          status: 'failed',
          error_message: apiError.message,
          ip_address: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
        });
      } catch (logError) {
        console.error('⚠️ Error logging failed claim:', logError);
      }
      
      return NextResponse.json({ 
        success: false,
        error: 'Failed to execute airdrop',
        details: apiError.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Error in POST /api/ambassador/payouts/[id]/claim:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

