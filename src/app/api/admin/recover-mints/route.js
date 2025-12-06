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

    // Use BaseScan API to get all transactions TO this contract (simpler than event logs)
    console.log(`🔍 Fetching all transactions to contract from BaseScan...`);
    
    const basescanApiKey = process.env.BASESCAN_API_KEY || '';
    // Get all transactions to the contract address
    const basescanUrl = `https://api.basescan.org/api?module=account&action=txlist&address=${contractAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${basescanApiKey}`;
    
    console.log(`📡 Calling BaseScan API...`);
    
    const basescanResponse = await fetch(basescanUrl);
    const responseText = await basescanResponse.text();
    
    let basescanData;
    try {
      basescanData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse BaseScan response:', responseText.substring(0, 200));
      throw new Error('BaseScan returned invalid response');
    }
    
    if (basescanData.status === '0' && basescanData.message !== 'No transactions found') {
      console.error('BaseScan API error:', basescanData);
      throw new Error(`BaseScan API error: ${basescanData.message || basescanData.result || 'Unknown error'}`);
    }
    
    const allTxs = Array.isArray(basescanData.result) ? basescanData.result : [];
    console.log(`📥 Found ${allTxs.length} total transactions to contract`);
    
    // Filter for successful mint transactions (claim function calls)
    // The claim function selector is 0x57bc3d78
    const mintTxs = allTxs.filter(tx => 
      tx.isError === '0' && // Successful tx
      tx.input && tx.input.startsWith('0x57bc3d78') // claim() function
    );
    
    console.log(`🎨 Found ${mintTxs.length} successful mint transactions`);
    
    // Parse mint transactions - we need to decode the quantity from input data
    const parsedLogs = mintTxs.map(tx => {
      // Input data format for claim(address,uint256,uint256,address,uint256,tuple,bytes)
      // 0x57bc3d78 + receiver(32) + tokenId(32) + quantity(32) + ...
      let quantity = 1;
      try {
        if (tx.input && tx.input.length >= 138) {
          // quantity is the 3rd parameter (after function selector + receiver + tokenId)
          // Each param is 32 bytes (64 hex chars), function selector is 4 bytes (8 hex chars)
          // quantity starts at position 8 + 64 + 64 = 136
          const quantityHex = '0x' + tx.input.slice(136, 200);
          quantity = parseInt(quantityHex, 16) || 1;
        }
      } catch (e) {
        console.warn(`Could not parse quantity from tx ${tx.hash}:`, e.message);
      }
      
      return {
        transactionHash: tx.hash,
        blockNumber: BigInt(tx.blockNumber),
        args: {
          claimer: tx.from.toLowerCase(),
          receiver: tx.from.toLowerCase(),
          tokenId: '0',
          quantityClaimed: quantity
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

