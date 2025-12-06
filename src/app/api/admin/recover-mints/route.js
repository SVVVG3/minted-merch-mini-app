import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateClaimSignature } from '@/lib/claimSignatureService';
import { withAdminAuth } from '@/lib/adminAuth';

/**
 * POST /api/admin/recover-mints
 * 
 * Batch recover missing mint records by querying on-chain events
 * and creating database records for mints that weren't recorded
 * 
 * Admin only - requires admin authentication
 */
async function handler(request) {
  try {
    const { dryRun = true } = await request.json();

    console.log(`🔄 Starting mint recovery (dryRun: ${dryRun})...`);

    // Get NeonStakingTicket campaign
    const { data: campaign } = await supabaseAdmin
      .from('nft_mints')
      .select('*')
      .eq('slug', 'NeonStakingTicket')
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const contractAddress = campaign.contract_address;
    console.log(`📋 Campaign: ${campaign.title}`);
    console.log(`📍 Contract: ${contractAddress}`);

    // Get all recorded transaction hashes
    const { data: existingClaims } = await supabaseAdmin
      .from('nft_mint_claims')
      .select('transaction_hash')
      .eq('campaign_id', campaign.id);

    const recordedTxHashes = new Set(
      existingClaims?.map(c => c.transaction_hash.toLowerCase()) || []
    );
    console.log(`📊 Already recorded: ${recordedTxHashes.size} transactions`);

    // Use BaseScan API V2 to get events (much more reliable than RPC for historical logs)
    console.log(`🔍 Fetching TokensClaimed events from BaseScan API V2...`);
    
    // TokensClaimed event topic
    const tokenClaimedTopic = '0xfa76a4010d9533e3e964f2930a65fb6042a12fa6ff5b08281837a10b0be7321e';
    
    const basescanApiKey = process.env.BASESCAN_API_KEY || '';
    // V2 API endpoint format
    const basescanUrl = `https://api.basescan.org/v2/api?chainid=8453&module=logs&action=getLogs&address=${contractAddress}&topic0=${tokenClaimedTopic}&startblock=0&endblock=latest&apikey=${basescanApiKey}`;
    
    console.log(`📡 Calling BaseScan API V2...`);
    
    const basescanResponse = await fetch(basescanUrl);
    const basescanData = await basescanResponse.json();
    
    // V2 API returns different format - check for errors
    if (basescanData.status === '0' && basescanData.result !== null) {
      // Check if it's just "No records found" which is OK
      if (basescanData.message === 'No records found' || basescanData.result === 'No records found') {
        console.log('📭 No events found on-chain');
      } else {
        console.error('BaseScan API error:', basescanData);
        throw new Error(`BaseScan API error: ${basescanData.message || basescanData.result || 'Unknown error'}`);
      }
    }
    
    const logs = Array.isArray(basescanData.result) ? basescanData.result : [];
    console.log(`📥 Found ${logs.length} TokensClaimed events from BaseScan`);
    
    // Parse BaseScan logs into the format we need
    // BaseScan returns: { topics: [...], data: '0x...', transactionHash: '0x...' }
    const parsedLogs = logs.map(log => {
      // Decode the log data
      // Topics: [eventSig, claimConditionIndex, claimer, receiver]
      // Data: tokenId (uint256) + quantityClaimed (uint256)
      const claimer = '0x' + log.topics[2].slice(26); // Remove padding
      const receiver = '0x' + log.topics[3].slice(26);
      const data = log.data;
      const tokenId = parseInt(data.slice(0, 66), 16).toString();
      const quantityClaimed = parseInt('0x' + data.slice(66), 16);
      
      return {
        transactionHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber),
        args: {
          claimer,
          receiver,
          tokenId,
          quantityClaimed
        }
      };
    });

    // Find missing mints
    const missingMints = [];
    for (const log of parsedLogs) {
      const txHash = log.transactionHash.toLowerCase();
      if (!recordedTxHashes.has(txHash)) {
        missingMints.push({
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          claimer: log.args.claimer,
          receiver: log.args.receiver,
          tokenId: log.args.tokenId || '0',
          quantity: Number(log.args.quantityClaimed || 1)
        });
      }
    }

    console.log(`❌ Missing mints: ${missingMints.length}`);

    if (missingMints.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No missing mints found!',
        stats: {
          onChainEvents: parsedLogs.length,
          recordedTransactions: recordedTxHashes.size,
          missingMints: 0
        }
      });
    }

    // If dry run, just return what would be recovered
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${missingMints.length} missing mints. Set dryRun=false to recover them.`,
        stats: {
          onChainEvents: parsedLogs.length,
          recordedTransactions: recordedTxHashes.size,
          missingMints: missingMints.length,
          totalQuantityMissing: missingMints.reduce((sum, m) => sum + m.quantity, 0)
        },
        missingMints: missingMints.slice(0, 20) // Show first 20
      });
    }

    // Recover missing mints
    console.log(`🔄 Recovering ${missingMints.length} missing mints...`);
    
    const recovered = [];
    const failed = [];

    for (const mint of missingMints) {
      try {
        // Try to find the user by their wallet address
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('fid, all_wallet_addresses')
          .or(`custody_address.ilike.${mint.claimer},all_wallet_addresses.cs.{${mint.claimer.toLowerCase()}}`)
          .limit(1)
          .single();

        if (!profile) {
          console.warn(`⚠️ No profile found for wallet ${mint.claimer}`);
          failed.push({ ...mint, reason: 'No profile found for wallet' });
          continue;
        }

        // Calculate reward amount
        const baseRewardAmount = BigInt(campaign.token_reward_amount);
        const scaledRewardAmount = (baseRewardAmount * BigInt(mint.quantity)).toString();

        // Create the mint claim record
        const { data: mintClaim, error: insertError } = await supabaseAdmin
          .from('nft_mint_claims')
          .insert({
            campaign_id: campaign.id,
            user_fid: profile.fid,
            wallet_address: mint.claimer.toLowerCase(),
            transaction_hash: mint.transactionHash,
            token_id: mint.tokenId,
            quantity: mint.quantity,
            token_reward_amount: scaledRewardAmount,
            minted_at: new Date().toISOString(),
            has_shared: false,
            has_claimed: false
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            // Duplicate - already exists
            console.log(`⏭️ Skipping duplicate: ${mint.transactionHash}`);
            continue;
          }
          throw insertError;
        }

        // Generate claim signature
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);

        const claimSignatureData = await generateClaimSignature({
          wallet: mint.claimer.toLowerCase(),
          amount: scaledRewardAmount,
          payoutId: mintClaim.id,
          deadline
        });

        // Store signature
        const serializableReq = {
          uid: claimSignatureData.req.uid,
          tokenAddress: claimSignatureData.req.tokenAddress,
          expirationTimestamp: claimSignatureData.req.expirationTimestamp.toString(),
          contents: claimSignatureData.req.contents.map(content => ({
            recipient: content.recipient,
            amount: content.amount.toString()
          }))
        };

        const claimDataJson = JSON.stringify({
          req: serializableReq,
          signature: claimSignatureData.signature
        });

        await supabaseAdmin
          .from('nft_mint_claims')
          .update({
            claim_signature: claimDataJson,
            claim_req: serializableReq,
            claim_signature_generated_at: new Date().toISOString(),
            claim_signature_expires_at: deadline.toISOString()
          })
          .eq('id', mintClaim.id);

        recovered.push({
          transactionHash: mint.transactionHash,
          fid: profile.fid,
          wallet: mint.claimer,
          quantity: mint.quantity,
          claimId: mintClaim.id
        });

        console.log(`✅ Recovered mint: ${mint.transactionHash} (FID: ${profile.fid}, qty: ${mint.quantity})`);

      } catch (error) {
        console.error(`❌ Failed to recover ${mint.transactionHash}:`, error.message);
        failed.push({ ...mint, reason: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recovered ${recovered.length} mints, ${failed.length} failed`,
      stats: {
        onChainEvents: parsedLogs.length,
        recordedTransactions: recordedTxHashes.size,
        missingMints: missingMints.length,
        recovered: recovered.length,
        failed: failed.length
      },
      recovered,
      failed
    });

  } catch (error) {
    console.error('❌ Recovery error:', error);
    return NextResponse.json(
      { error: error.message || 'Recovery failed' },
      { status: 500 }
    );
  }
}

export const POST = withAdminAuth(handler);

