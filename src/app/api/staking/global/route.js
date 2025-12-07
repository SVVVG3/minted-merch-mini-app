// API: Get global staking stats (public - no auth required)
// GET /api/staking/global

import { NextResponse } from 'next/server';
import { getGlobalTotalStaked } from '@/lib/stakingBalanceAPI';
import { getCirculatingSupply, calculateStakedPercentage } from '@/lib/circulatingSupply';

// Helper to format numbers with commas
function formatNumberFull(num) {
  if (!num && num !== 0) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(num);
}

export async function GET() {
  try {
    // Get global total staked from subgraph
    const globalTotalStaked = await getGlobalTotalStaked();
    
    // Get circulating supply from shared module (uses single cache)
    const circulatingSupply = await getCirculatingSupply();
    
    // Calculate staked percentage using shared function
    const stakedPercentage = calculateStakedPercentage(globalTotalStaked, circulatingSupply);

    return NextResponse.json({
      success: true,
      global_total_staked: globalTotalStaked,
      global_total_staked_formatted: formatNumberFull(globalTotalStaked),
      circulating_supply: circulatingSupply,
      staked_percentage: stakedPercentage
    });

  } catch (error) {
    console.error('Error fetching global staking stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch global staking stats' },
      { status: 500 }
    );
  }
}
