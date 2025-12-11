// Mogul API - Get Claim Data for Payout
// GET: Returns req + signature needed for on-chain claim
// SECURITY: Requires JWT auth + mogul status + ownership via bounty_submissions.ambassador_fid

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { checkMissionsEligibility } from '@/lib/mogulHelpers';
import { supabaseAdmin } from '@/lib/supabase';
import { isSignatureExpired } from '@/lib/claimSignatureService';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // 1. Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized - No token provided' 
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
    console.log(`💰 Fetching mogul claim data for payout ${id} (FID: ${userFid})`);
    
    // 2. Check if user is eligible for Minted Merch Missions (50M+ tokens OR 1M+ staked)
    const { isEligible, isMogul, isStaker, tokenBalance, stakedBalance } = await checkMissionsEligibility(userFid);
    
    if (!isEligible) {
      console.error(`❌ User FID ${userFid} is not eligible for missions`);
      return NextResponse.json({ 
        success: false,
        error: 'Missions eligibility required (50M+ tokens OR 1M+ staked)',
        tokenBalance,
        stakedBalance,
        requiredBalance: 50_000_000,
        requiredStaked: 1_000_000
      }, { status: 403 });
    }
    
    // 3. Get payout with ownership verification via bounty_submissions.ambassador_fid
    // Mogul payouts have ambassador_id = NULL
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select(`
        *,
        bounty_submissions!inner(
          id,
          ambassador_fid,
          bounties(title)
        )
      `)
      .eq('id', id)
      .is('ambassador_id', null) // Mogul payouts have NULL ambassador_id
      .eq('bounty_submissions.ambassador_fid', userFid) // Security: verify ownership via FID
      .single();
    
    if (payoutError || !payout) {
      console.error(`❌ Mogul payout access denied: ${id} for FID ${userFid}`, payoutError);
      return NextResponse.json({ 
        success: false,
        error: 'Payout not found or access denied' 
      }, { status: 404 });
    }
    
    // 4. Validate payout status
    if (payout.status !== 'claimable') {
      return NextResponse.json({ 
        success: false,
        error: 'Payout is not claimable',
        currentStatus: payout.status,
        message: payout.status === 'completed' 
          ? 'This payout has already been claimed'
          : 'This payout is not yet ready to claim'
      }, { status: 400 });
    }
    
    // 5. Validate wallet address exists
    if (!payout.wallet_address) {
      return NextResponse.json({ 
        success: false,
        error: 'No wallet address configured',
        message: 'Please add a wallet address to your profile before claiming'
      }, { status: 400 });
    }
    
    // 6. Check if signature expired
    if (isSignatureExpired(payout.claim_deadline)) {
      console.error(`❌ Signature expired for mogul payout ${id}`);
      return NextResponse.json({ 
        success: false,
        error: 'Claim deadline has passed',
        deadline: payout.claim_deadline,
        message: 'This payout claim has expired. Please contact support.'
      }, { status: 400 });
    }
    
    // 7. Validate signature exists
    if (!payout.claim_signature) {
      console.error(`❌ No claim signature for mogul payout ${id}`);
      return NextResponse.json({ 
        success: false,
        error: 'Claim signature not available',
        message: 'This payout is not properly configured. Please contact support.'
      }, { status: 500 });
    }
    
    // 8. Parse the stored claim data
    let claimData;
    try {
      claimData = JSON.parse(payout.claim_signature);
      
      if (!claimData.req || !claimData.signature) {
        throw new Error('Invalid claim data format');
      }
    } catch (parseError) {
      console.error(`❌ Error parsing claim data for mogul payout ${id}:`, parseError);
      return NextResponse.json({ 
        success: false,
        error: 'Invalid claim data',
        message: 'This payout has corrupted claim data. Please contact support.'
      }, { status: 500 });
    }
    
    // 9. Log access for security monitoring
    try {
      await supabaseAdmin.from('payout_claim_events').insert({
        payout_id: id,
        user_fid: userFid,
        wallet_address: payout.wallet_address,
        signature_used: claimData.signature.slice(0, 20) + '...',
        status: 'data_accessed',
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
      });
    } catch (logError) {
      console.error('❌ Error logging mogul claim access:', logError);
      // Continue anyway - logging is not critical
    }
    
    const contractAddress = process.env.AIRDROP_CONTRACT_ADDRESS;
    
    console.log(`✅ Mogul claim data provided for payout ${id} (FID: ${userFid})`, {
      uid: claimData.req.uid.slice(0, 10) + '...',
      recipient: claimData.req.contents[0].recipient.slice(0, 6) + '...' + claimData.req.contents[0].recipient.slice(-4),
      amount: claimData.req.contents[0].amount,
      expirationTimestamp: new Date(Number(claimData.req.expirationTimestamp) * 1000).toISOString()
    });
    
    return NextResponse.json({
      success: true,
      data: {
        payoutId: payout.id,
        bountyTitle: payout.bounty_submissions?.bounties?.title || 'Mission Payout',
        req: claimData.req,
        signature: claimData.signature,
        contractAddress,
        walletAddress: payout.wallet_address,
        amountTokens: payout.amount_tokens.toString(),
        tokenAddress: claimData.req.tokenAddress,
        deadline: payout.claim_deadline
      }
    });
    
  } catch (error) {
    console.error('❌ Error in GET /api/mogul/payouts/[id]/claim-data:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}

