import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedFid } from '@/lib/userAuth';
import { getCurrent8AMPST } from '@/lib/timezone';

// WETH address on Base (for filtering DexScreener pairs)
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

// USD value per spin win
const USD_VALUE_PER_SPIN = 0.01;

/**
 * Get daily spin allocation based on Mojo score
 */
function getSpinAllocation(mojoScore) {
  const score = parseFloat(mojoScore) || 0;
  if (score >= 0.50) return 3;
  if (score >= 0.30) return 2;
  return 1;
}

/**
 * Fetch token price from DexScreener API
 */
async function getTokenPrice(contractAddress) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      console.error(`DexScreener API error for ${contractAddress}:`, response.status);
      return null;
    }

    const data = await response.json();

    if (!data?.pairs?.length) {
      return null;
    }

    // Filter for Base chain + WETH pairs
    const validPairs = data.pairs.filter(pair =>
      pair.chainId === 'base' &&
      pair.quoteToken?.address?.toLowerCase() === WETH_ADDRESS.toLowerCase()
    );

    if (validPairs.length === 0) {
      const basePairs = data.pairs.filter(pair => pair.chainId === 'base');
      if (basePairs.length > 0) {
        const bestPair = basePairs.reduce((best, current) =>
          (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best
        );
        return parseFloat(bestPair.priceUsd) || null;
      }
      return null;
    }

    const bestPair = validPairs.reduce((best, current) =>
      (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best
    );

    return parseFloat(bestPair.priceUsd) || null;

  } catch (error) {
    console.error(`Error fetching price for ${contractAddress}:`, error);
    return null;
  }
}

/**
 * Weighted random selection of a token
 */
function selectWeightedToken(tokens) {
  // Calculate total weight
  const totalWeight = tokens.reduce((sum, t) => sum + t.probability_weight, 0);
  
  // Generate random number between 0 and totalWeight
  const random = Math.random() * totalWeight;
  
  // Find the token that matches this random value
  let cumulative = 0;
  for (const token of tokens) {
    cumulative += token.probability_weight;
    if (random < cumulative) {
      return token;
    }
  }
  
  // Fallback to last token (shouldn't happen)
  return tokens[tokens.length - 1];
}

/**
 * Calculate token amount for given USD value
 * Returns amount in wei (18 decimals)
 */
function calculateTokenAmount(usdValue, tokenPrice, decimals = 18) {
  if (!tokenPrice || tokenPrice <= 0) {
    return null;
  }
  
  // tokens = usdValue / tokenPrice
  const tokenAmount = usdValue / tokenPrice;
  
  // Convert to wei (multiply by 10^decimals)
  const weiAmount = BigInt(Math.floor(tokenAmount * Math.pow(10, decimals)));
  
  return weiAmount.toString();
}

/**
 * POST /api/dailyspin/spin
 * 
 * Execute a daily spin:
 * 1. Verify user has spins remaining
 * 2. Select random token (weighted)
 * 3. Fetch live price from DexScreener
 * 4. Calculate token amount for $0.01
 * 5. Record winning in database
 * 
 * Requires authentication.
 */
export async function POST(request) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    // Authenticate user
    const fid = await getAuthenticatedFid(request);
    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`[${requestId}] 🎰 Spin request from FID ${fid}`);

    // Get today's date (8 AM PST boundary)
    const todayStart = getCurrent8AMPST();
    const todayDate = todayStart.toISOString().split('T')[0];

    // Fetch user's Mojo score
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('mojo_score')
      .eq('fid', fid)
      .single();

    const mojoScore = profile?.mojo_score || 0;
    const dailyAllocation = getSpinAllocation(mojoScore);

    // Count spins used today
    const { count: spinsUsedToday, error: countError } = await supabaseAdmin
      .from('spin_winnings')
      .select('*', { count: 'exact', head: true })
      .eq('user_fid', fid)
      .eq('spin_date', todayDate);

    if (countError) {
      console.error(`[${requestId}] Error counting spins:`, countError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify spin eligibility' },
        { status: 500 }
      );
    }

    const usedSpins = spinsUsedToday || 0;
    const remainingSpins = dailyAllocation - usedSpins;

    // SECURITY: Check if user has spins remaining
    if (remainingSpins <= 0) {
      console.log(`[${requestId}] ❌ No spins remaining for FID ${fid}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'No spins remaining today',
          spinsUsed: usedSpins,
          dailyAllocation
        },
        { status: 400 }
      );
    }

    // Fetch active tokens
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from('spin_tokens')
      .select('*')
      .eq('is_active', true);

    if (tokensError || !tokens?.length) {
      console.error(`[${requestId}] Error fetching tokens:`, tokensError);
      return NextResponse.json(
        { success: false, error: 'No tokens available' },
        { status: 500 }
      );
    }

    // Select random token (weighted)
    const selectedToken = selectWeightedToken(tokens);
    console.log(`[${requestId}] 🎲 Selected token: ${selectedToken.symbol} (weight: ${selectedToken.probability_weight})`);

    const newRemainingSpins = remainingSpins - 1;

    // Check if this is a "no win" spin (MISS token)
    if (selectedToken.symbol === 'MISS') {
      console.log(`[${requestId}] 😢 No win for FID ${fid} - Better luck next time!`);
      
      // Don't record anything in spin_winnings for misses
      // But we still count it as a used spin (tracked by counting winnings + misses would be complex)
      // Instead, we'll track daily spins separately or just let them spin again
      
      // Actually, we need to track that they used a spin even on a miss
      // Let's record a "miss" entry with 0 amount that won't be claimable
      const { error: insertError } = await supabaseAdmin
        .from('spin_winnings')
        .insert({
          user_fid: fid,
          token_id: selectedToken.id,
          amount: '0',
          usd_value: 0,
          token_price: 0,
          spin_date: todayDate,
          claimed: true // Mark as claimed so it doesn't show up in unclaimed
        });

      if (insertError) {
        console.error(`[${requestId}] ❌ Error recording miss:`, insertError);
        // Continue anyway - the spin happened
      }

      return NextResponse.json({
        success: true,
        spin: {
          isWin: false,
          token: {
            id: selectedToken.id,
            symbol: selectedToken.symbol,
            name: selectedToken.name,
            color: selectedToken.segment_color
          },
          message: 'Better Luck Next Time!'
        },
        status: {
          spinsUsedToday: usedSpins + 1,
          spinsRemaining: newRemainingSpins,
          dailyAllocation,
          canSpin: newRemainingSpins > 0
        }
      });
    }

    // This is a winning spin - fetch price and calculate amount
    const tokenPrice = await getTokenPrice(selectedToken.contract_address);
    
    if (!tokenPrice) {
      console.error(`[${requestId}] ❌ Could not fetch price for ${selectedToken.symbol}`);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch token price. Please try again.' },
        { status: 503 }
      );
    }

    console.log(`[${requestId}] 💰 ${selectedToken.symbol} price: $${tokenPrice}`);

    // Calculate token amount for $0.01
    const tokenAmount = calculateTokenAmount(USD_VALUE_PER_SPIN, tokenPrice, selectedToken.decimals);
    
    if (!tokenAmount) {
      console.error(`[${requestId}] ❌ Could not calculate token amount`);
      return NextResponse.json(
        { success: false, error: 'Failed to calculate reward amount' },
        { status: 500 }
      );
    }

    console.log(`[${requestId}] 🪙 Calculated amount: ${tokenAmount} wei (${selectedToken.symbol})`);

    // Record winning in database
    const { data: winning, error: insertError } = await supabaseAdmin
      .from('spin_winnings')
      .insert({
        user_fid: fid,
        token_id: selectedToken.id,
        amount: tokenAmount,
        usd_value: USD_VALUE_PER_SPIN,
        token_price: tokenPrice,
        spin_date: todayDate,
        claimed: false
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${requestId}] ❌ Error recording winning:`, insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to record spin result' },
        { status: 500 }
      );
    }

    console.log(`[${requestId}] ✅ Spin complete for FID ${fid}:`, {
      token: selectedToken.symbol,
      amount: tokenAmount,
      price: tokenPrice,
      spinsRemaining: newRemainingSpins
    });

    return NextResponse.json({
      success: true,
      spin: {
        isWin: true,
        winningId: winning.id,
        token: {
          id: selectedToken.id,
          symbol: selectedToken.symbol,
          name: selectedToken.name,
          contractAddress: selectedToken.contract_address,
          color: selectedToken.segment_color,
          decimals: selectedToken.decimals
        },
        amount: tokenAmount,
        displayAmount: (parseFloat(tokenAmount) / Math.pow(10, selectedToken.decimals)).toFixed(4),
        usdValue: USD_VALUE_PER_SPIN.toFixed(2),
        tokenPrice: tokenPrice.toFixed(10)
      },
      status: {
        spinsUsedToday: usedSpins + 1,
        spinsRemaining: newRemainingSpins,
        dailyAllocation,
        canSpin: newRemainingSpins > 0
      }
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Error in /api/dailyspin/spin:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

