// Ambassador API - Get Claim Data for Payout
// GET: Returns signature and data needed to claim payout

import { NextResponse } from 'next/server';
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
    
    // Verify JWT token (simplified - assumes token contains FID)
    // In production, you'd verify the JWT signature
    let userFid;
    try {
      // For now, we'll verify this through database lookup
      // The token should be the same one used in other API calls
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      
      if (userError || !user) {
        return NextResponse.json({ 
          success: false,
          error: 'Invalid authentication token' 
        }, { status: 401 });
      }
      
      userFid = user.user_metadata?.fid;
      if (!userFid) {
        return NextResponse.json({ 
          success: false,
          error: 'No FID found in token' 
        }, { status: 400 });
      }
    } catch (authError) {
      console.error('❌ Authentication error:', authError);
      return NextResponse.json({ 
        success: false,
        error: 'Authentication failed' 
      }, { status: 401 });
    }
    
    // 2. Get payout with ownership verification
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('ambassador_payouts')
      .select(`
        *,
        bounty_submissions!inner(
          user_fid,
          bounties(title)
        )
      `)
      .eq('id', id)
      .eq('bounty_submissions.user_fid', userFid) // Security: only own payouts
      .single();
    
    if (payoutError || !payout) {
      console.error(`❌ Payout access denied: ${id} for FID ${userFid}`, payoutError);
      return NextResponse.json({ 
        success: false,
        error: 'Payout not found or access denied' 
      }, { status: 404 });
    }
    
    // 3. Validate payout status
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
    
    // 4. Validate wallet address exists
    if (!payout.wallet_address) {
      return NextResponse.json({ 
        success: false,
        error: 'No wallet address configured',
        message: 'Please add a wallet address to your profile before claiming'
      }, { status: 400 });
    }
    
    // 5. Check if signature expired
    if (isSignatureExpired(payout.claim_deadline)) {
      console.error(`❌ Signature expired for payout ${id}`);
      return NextResponse.json({ 
        success: false,
        error: 'Claim deadline has passed',
        deadline: payout.claim_deadline,
        message: 'This payout claim has expired. Please contact support.'
      }, { status: 400 });
    }
    
    // 6. Validate signature exists
    if (!payout.claim_signature) {
      console.error(`❌ No claim signature for payout ${id}`);
      return NextResponse.json({ 
        success: false,
        error: 'Claim signature not available',
        message: 'This payout is not properly configured. Please contact support.'
      }, { status: 500 });
    }
    
    // 7. Log access for security monitoring
    try {
      await supabaseAdmin.from('payout_claim_events').insert({
        payout_id: id,
        user_fid: userFid,
        wallet_address: payout.wallet_address,
        signature_used: payout.claim_signature.slice(0, 20) + '...', // Truncate for storage
        status: 'data_accessed',
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
      });
    } catch (logError) {
      console.error('❌ Error logging claim access:', logError);
      // Continue anyway - logging is not critical
    }
    
    // 8. Return claim data
    console.log(`✅ Claim data provided for payout ${id} (FID: ${userFid})`);
    
    return NextResponse.json({
      success: true,
      data: {
        payoutId: payout.id,
        bountyTitle: payout.bounty_submissions.bounties.title,
        walletAddress: payout.wallet_address,
        amountTokens: payout.amount_tokens.toString(),
        signature: payout.claim_signature,
        deadline: payout.claim_deadline,
        contractAddress: process.env.AIRDROP_CONTRACT_ADDRESS,
        tokenAddress: process.env.MINTEDMERCH_TOKEN_ADDRESS
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

