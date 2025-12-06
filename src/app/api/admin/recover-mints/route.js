import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateClaimSignature } from '@/lib/claimSignatureService';

/**
 * POST /api/admin/recover-mints
 * 
 * Batch recover missing mint records by querying on-chain events
 * and creating database records for mints that weren't recorded
 * 
 * Admin only - requires admin authentication
 */
export async function POST(request) {
  try {
    // Simple admin check - you may want to add proper auth
    const { adminKey, dryRun = true } = await request.json();
    
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Query on-chain events using viem
    const { createPublicClient, http, parseAbiItem } = await import('viem');
    const { base } = await import('viem/chains');

    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.ALCHEMY_BASE_RPC_URL || 'https://mainnet.base.org')
    });

    // Get TokensClaimed events from the contract
    // TokensClaimed(uint256 indexed claimConditionIndex, address indexed claimer, address indexed receiver, uint256 tokenId, uint256 quantityClaimed)
    console.log(`🔍 Fetching TokensClaimed events from contract...`);
    
    const logs = await publicClient.getLogs({
      address: contractAddress,
      event: parseAbiItem('event TokensClaimed(uint256 indexed claimConditionIndex, address indexed claimer, address indexed receiver, uint256 tokenId, uint256 quantityClaimed)'),
      fromBlock: 'earliest',
      toBlock: 'latest'
    });

    console.log(`📥 Found ${logs.length} TokensClaimed events`);

    // Find missing mints
    const missingMints = [];
    for (const log of logs) {
      const txHash = log.transactionHash.toLowerCase();
      if (!recordedTxHashes.has(txHash)) {
        missingMints.push({
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          claimer: log.args.claimer,
          receiver: log.args.receiver,
          tokenId: log.args.tokenId?.toString() || '0',
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
          onChainEvents: logs.length,
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
          onChainEvents: logs.length,
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
        onChainEvents: logs.length,
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

