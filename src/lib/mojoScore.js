/**
 * Minted Merch Mojo Score Calculator
 * 
 * A composite score (0-1) combining:
 * - Neynar Score (10%)
 * - Quotient Score (15%)
 * - Staking Amount (20%)
 * - Holdings (5%)
 * - Purchase $ Amount (25%)
 * - Check-in Engagement (10%)
 * - Missions (10%)
 * - Mints (5%)
 */

// Weights for each factor
const WEIGHTS = {
  neynar: 0.10,
  quotient: 0.15,
  staking: 0.20,
  holdings: 0.05,
  purchases: 0.25,
  checkIns: 0.10,
  missions: 0.10,
  mints: 0.05,
};

// Thresholds
const STAKING_MAX = 1_000_000_000; // 1B tokens for 1.0
const HOLDINGS_MAX = 1_000_000_000; // 1B tokens for 1.0
const PURCHASE_MAX = 500; // $500 for 1.0
const CHECKIN_DAYS = 100; // 100 days for 1.0
const MISSIONS_MAX = 50; // 50 approved missions for 1.0
const MINTS_MAX = 30_000; // 30,000 mint points for 1.0

// Key thresholds for tiered scaling (staking/holdings)
const TIER_THRESHOLDS = {
  prizeEligible: 10_000_000,   // 10M
  merchMogul: 50_000_000,      // 50M
  whale: 200_000_000,          // 200M
  max: 1_000_000_000,          // 1B
};

// Purchase tier thresholds
const PURCHASE_TIERS = {
  starter: 50,      // $50 → ~0.25
  regular: 100,     // $100 → ~0.50
  loyal: 250,       // $250 → ~0.75
  max: 500,         // $500 → 1.0
};

/**
 * Calculate tiered logarithmic score for staking/holdings
 * Provides meaningful bumps at key thresholds:
 * - 10M (prize eligible) → ~0.25
 * - 50M (Merch Mogul) → ~0.50
 * - 200M (Whale) → ~0.75
 * - 1B (Max) → 1.00
 */
function calculateTieredTokenScore(amount) {
  if (!amount || amount <= 0) return 0;
  if (amount >= TIER_THRESHOLDS.max) return 1.0;
  
  // Use logarithmic scaling with adjustments for tier bumps
  // log10(1B) ≈ 9, log10(10M) ≈ 7, log10(50M) ≈ 7.7, log10(200M) ≈ 8.3
  const logAmount = Math.log10(amount + 1);
  const logMax = Math.log10(TIER_THRESHOLDS.max);
  const logMin = Math.log10(1_000_000); // Start meaningful scoring at 1M
  
  // Normalize to 0-1 range with log scaling
  let score = (logAmount - logMin) / (logMax - logMin);
  score = Math.max(0, Math.min(1, score));
  
  // Apply slight boost at tier thresholds for psychological impact
  if (amount >= TIER_THRESHOLDS.whale) {
    score = Math.max(score, 0.75);
  } else if (amount >= TIER_THRESHOLDS.merchMogul) {
    score = Math.max(score, 0.50);
  } else if (amount >= TIER_THRESHOLDS.prizeEligible) {
    score = Math.max(score, 0.25);
  }
  
  return Math.min(1, score);
}

/**
 * Calculate tiered purchase score with bumps at key thresholds
 * $50 → ~0.25, $100 → ~0.50, $250 → ~0.75, $500+ → 1.0
 */
function calculatePurchaseScore(totalSpent) {
  if (!totalSpent || totalSpent <= 0) return 0;
  if (totalSpent >= PURCHASE_TIERS.max) return 1.0;
  
  // Linear base score
  let score = totalSpent / PURCHASE_TIERS.max;
  
  // Apply tier bumps for psychological impact
  if (totalSpent >= PURCHASE_TIERS.loyal) {
    score = Math.max(score, 0.75);
  } else if (totalSpent >= PURCHASE_TIERS.regular) {
    score = Math.max(score, 0.50);
  } else if (totalSpent >= PURCHASE_TIERS.starter) {
    score = Math.max(score, 0.25);
  }
  
  return Math.min(1, score);
}

/**
 * Calculate check-in engagement score
 * Based on check-ins in the last 100 days
 * 0 days = 0, 100 days = 1.0
 */
function calculateCheckInScore(checkInCount) {
  if (!checkInCount || checkInCount <= 0) return 0;
  return Math.min(1, checkInCount / CHECKIN_DAYS);
}

/**
 * Calculate missions score
 * Based on approved mission submissions
 * 0 missions = 0, 50 missions = 1.0
 */
function calculateMissionsScore(approvedMissions) {
  if (!approvedMissions || approvedMissions <= 0) return 0;
  return Math.min(1, approvedMissions / MISSIONS_MAX);
}

/**
 * Calculate mints score
 * Based on mint points earned
 * 0 points = 0, 30,000 points = 1.0
 */
function calculateMintsScore(mintPoints) {
  if (!mintPoints || mintPoints <= 0) return 0;
  return Math.min(1, mintPoints / MINTS_MAX);
}

/**
 * Calculate the full Mojo Score with breakdown
 * @param {Object} data - User data
 * @param {number} data.neynarScore - Neynar score (0-1)
 * @param {number} data.quotientScore - Quotient score (0-1)
 * @param {number} data.stakedBalance - Staked token balance
 * @param {number} data.totalBalance - Total token holdings
 * @param {number} data.totalPurchaseAmount - Total $ spent on purchases
 * @param {number} data.checkInCount - Number of check-ins in last 100 days
 * @param {number} data.approvedMissions - Number of approved mission submissions
 * @param {number} data.mintPoints - Mint points earned
 * @returns {Object} - Mojo score and breakdown
 */
export function calculateMojoScore(data) {
  const {
    neynarScore = 0,
    quotientScore = 0,
    stakedBalance = 0,
    totalBalance = 0,
    totalPurchaseAmount = 0,
    checkInCount = 0,
    approvedMissions = 0,
    mintPoints = 0,
  } = data;

  // Calculate individual component scores (all 0-1)
  const components = {
    neynar: {
      raw: neynarScore || 0,
      normalized: Math.min(1, Math.max(0, neynarScore || 0)),
      weight: WEIGHTS.neynar,
    },
    quotient: {
      raw: quotientScore || 0,
      normalized: Math.min(1, Math.max(0, quotientScore || 0)),
      weight: WEIGHTS.quotient,
    },
    staking: {
      raw: stakedBalance || 0,
      normalized: calculateTieredTokenScore(stakedBalance),
      weight: WEIGHTS.staking,
    },
    holdings: {
      raw: totalBalance || 0,
      normalized: calculateTieredTokenScore(totalBalance),
      weight: WEIGHTS.holdings,
    },
    purchases: {
      raw: totalPurchaseAmount || 0,
      normalized: calculatePurchaseScore(totalPurchaseAmount),
      weight: WEIGHTS.purchases,
    },
    checkIns: {
      raw: checkInCount || 0,
      normalized: calculateCheckInScore(checkInCount),
      weight: WEIGHTS.checkIns,
    },
    missions: {
      raw: approvedMissions || 0,
      normalized: calculateMissionsScore(approvedMissions),
      weight: WEIGHTS.missions,
    },
    mints: {
      raw: mintPoints || 0,
      normalized: calculateMintsScore(mintPoints),
      weight: WEIGHTS.mints,
    },
  };

  // Calculate weighted contributions
  for (const key of Object.keys(components)) {
    components[key].weighted = components[key].normalized * components[key].weight;
  }

  // Calculate final Mojo score
  const mojoScore = Object.values(components).reduce((sum, comp) => sum + comp.weighted, 0);

  return {
    score: Math.round(mojoScore * 1000) / 1000, // Round to 3 decimal places
    breakdown: components,
    weights: WEIGHTS,
  };
}

/**
 * Get Mojo tier based on score
 */
export function getMojoTier(score) {
  if (score >= 0.9) return { tier: 'Legendary', color: 'text-purple-500' };
  if (score >= 0.75) return { tier: 'Elite', color: 'text-blue-500' };
  if (score >= 0.6) return { tier: 'Influential', color: 'text-green-500' };
  if (score >= 0.4) return { tier: 'Active', color: 'text-yellow-500' };
  if (score >= 0.2) return { tier: 'Casual', color: 'text-orange-500' };
  return { tier: 'New', color: 'text-gray-500' };
}

/**
 * Get color class for Mojo score display
 */
export function getMojoColor(score) {
  if (score >= 0.9) return 'text-purple-500';
  if (score >= 0.75) return 'text-blue-500';
  if (score >= 0.6) return 'text-green-500';
  if (score >= 0.4) return 'text-yellow-500';
  if (score >= 0.2) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount) {
  if (!amount) return '0';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(0);
}

