// Ambassador API - Get Claim Data for Payout
// GET: Returns req + signature needed for airdropERC20WithSignature (Thirdweb SDK format)

import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { checkAmbassadorStatus } from '@/lib/ambassadorHelpers';
import { supabaseAdmin } from '@/lib/supabase';
import { isSignatureExpired } from '@/lib/claimSignatureService';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // 1. Authenticate ambassador
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
    console.log(`💰 Fetching claim data for payout ${id} (FID: ${userFid})`);
    
    // 2. Check if user is an active ambassador
    const { isAmbassador, ambassadorId } = await checkAmbassadorStatus(userFid);
    
    if (!isAmbassador || !ambassadorId) {
      console.error(`❌ User FID ${userFid} is not an active ambassador`);
      return NextResponse.json({ 
        success: false,
        error: 'User is not an active ambassador' 
      }, { status: 403 });
    }
    
    // 3. Get payout with ownership verification
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select(`
        *,
        bounty_submissions(
          id,
          bounties(title)
        )
      `)
      .eq('id', id)
      .eq('ambassador_id', ambassadorId) // Security: only own payouts
      .single();
    
    if (payoutError || !payout) {
      console.error(`❌ Payout access denied: ${id} for ambassador ${ambassadorId}`, payoutError);
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
      console.error(`❌ Signature expired for payout ${id}`);
      return NextResponse.json({ 
        success: false,
        error: 'Claim deadline has passed',
        deadline: payout.claim_deadline,
        message: 'This payout claim has expired. Please contact support.'
      }, { status: 400 });
    }
    
    // 7. Validate signature exists
    if (!payout.claim_signature) {
      console.error(`❌ No claim signature for payout ${id}`);
      return NextResponse.json({ 
        success: false,
        error: 'Claim signature not available',
        message: 'This payout is not properly configured. Please contact support.'
      }, { status: 500 });
    }
    
    // 8. Parse the stored claim data (req + signature from Thirdweb SDK)
    let claimData;
    try {
      claimData = JSON.parse(payout.claim_signature);
      
      if (!claimData.req || !claimData.signature) {
        throw new Error('Invalid claim data format');
      }
      
      // Note: BigInt values are stored as strings and will be kept as strings
      // The frontend will convert them back to BigInt when using with thirdweb SDK
    } catch (parseError) {
      console.error(`❌ Error parsing claim data for payout ${id}:`, parseError);
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
        signature_used: claimData.signature.slice(0, 20) + '...', // Truncate for storage
        status: 'data_accessed',
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
      });
    } catch (logError) {
      console.error('❌ Error logging claim access:', logError);
      // Continue anyway - logging is not critical
    }
    
    const contractAddress = process.env.AIRDROP_CONTRACT_ADDRESS;
    
    console.log(`✅ Claim data provided for payout ${id} (FID: ${userFid})`, {
      uid: claimData.req.uid.slice(0, 10) + '...',
      recipient: claimData.req.contents[0].recipient.slice(0, 6) + '...' + claimData.req.contents[0].recipient.slice(-4),
      amount: claimData.req.contents[0].amount, // Already a string
      expirationTimestamp: new Date(Number(claimData.req.expirationTimestamp) * 1000).toISOString()
    });
    
    return NextResponse.json({
      success: true,
      data: {
        payoutId: payout.id,
        bountyTitle: payout.bounty_submissions.bounties.title,
        // Thirdweb SDK airdrop parameters (ready for airdropERC20WithSignature)
        req: claimData.req,                   // Full request struct from SDK
        signature: claimData.signature,       // EIP-712 signature from SDK
        contractAddress,                      // Airdrop contract
        // For display purposes
        walletAddress: payout.wallet_address,
        amountTokens: payout.amount_tokens.toString(),
        tokenAddress: claimData.req.tokenAddress,
        deadline: payout.claim_deadline
      }
    });
    
  } catch (error) {
    console.error('❌ Error in GET /api/ambassador/payouts/[id]/claim-data:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }, { status: 500 });
  }
}

