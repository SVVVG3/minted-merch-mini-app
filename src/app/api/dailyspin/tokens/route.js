import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// WETH address on Base (for filtering DexScreener pairs)
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

/**
 * Fetch token price from DexScreener API
 * Filters for Base chain WETH pairs for accuracy
 */
async function getTokenPrice(contractAddress) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 } // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      console.error(`DexScreener API error for ${contractAddress}:`, response.status);
      return null;
    }

    const data = await response.json();

    if (!data?.pairs?.length) {
      console.warn(`No pairs found for ${contractAddress}`);
      return null;
    }

    // Filter for Base chain + WETH pairs
    const validPairs = data.pairs.filter(pair =>
      pair.chainId === 'base' &&
      pair.quoteToken?.address?.toLowerCase() === WETH_ADDRESS.toLowerCase()
    );

    if (validPairs.length === 0) {
      // Fallback to any Base pair
      const basePairs = data.pairs.filter(pair => pair.chainId === 'base');
      if (basePairs.length > 0) {
        // Get highest liquidity pair
        const bestPair = basePairs.reduce((best, current) =>
          (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best
        );
        return parseFloat(bestPair.priceUsd) || null;
      }
      return null;
    }

    // Get highest liquidity WETH pair
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
 * GET /api/dailyspin/tokens
 * 
 * Returns list of active spin tokens with current prices.
 * Public endpoint - no auth required.
 */
export async function GET() {
  try {
    // Fetch active tokens from database (ordered for consistent wheel display)
    const { data: tokens, error } = await supabaseAdmin
      .from('spin_tokens')
      .select('id, symbol, name, contract_address, decimals, probability_weight, segment_color, logo_url, shop_url, dexscreener_url, description')
      .eq('is_active', true)
      .order('created_at', { ascending: true }); // Consistent order for wheel segments

    if (error) {
      console.error('Error fetching spin tokens:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tokens' },
        { status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active tokens configured' },
        { status: 404 }
      );
    }

    // Fetch prices for all tokens in parallel
    const tokensWithPrices = await Promise.all(
      tokens.map(async (token) => {
        const price = await getTokenPrice(token.contract_address);
        return {
          ...token,
          price_usd: price,
          // Calculate how many tokens = $0.01
          tokens_per_spin: price ? (0.01 / price) : null
        };
      })
    );

    // Calculate total weight for probability display
    const totalWeight = tokens.reduce((sum, t) => sum + t.probability_weight, 0);

    // Get base URL for logo paths
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop';

    return NextResponse.json({
      success: true,
      tokens: tokensWithPrices.map((token, index) => ({
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        contractAddress: token.contract_address,
        decimals: token.decimals,
        color: token.segment_color,
        logoUrl: token.logo_url ? `${baseUrl}${token.logo_url}` : null,
        shopUrl: token.shop_url || null, // Link to collection/product page
        dexscreenerUrl: token.dexscreener_url || null, // Custom DexScreener link
        description: token.description || null // Token description for win modal
        priceUsd: token.price_usd,
        tokensPerSpin: token.tokens_per_spin,
        probability: token.probability_weight / totalWeight,
        segmentIndex: index  // For wheel alignment
      })),
      totalWeight
    });

  } catch (error) {
    console.error('Error in /api/dailyspin/tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

