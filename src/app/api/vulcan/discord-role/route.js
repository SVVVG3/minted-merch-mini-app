/**
 * Vulcan Custom Webhook — Discord Role Gate
 *
 * Vulcan POSTs a wallet address (or list of wallets) and expects:
 *   200 { success: true }  → grant the role
 *   200 { success: false } → deny / remove the role
 *   404                    → wallet has never interacted with the staking contract
 *
 * Role requirement: combined staked $MINTEDMERCH across all provided wallets >= 50,000,000 tokens
 *
 * Uses Goldsky GraphQL directly (live on-chain data) so role adds/removes
 * reflect the actual current staked balance, not a cached DB value.
 */

const GOLDSKY_ENDPOINT = 'https://api.goldsky.com/api/public/project_cmhgzsg1lfhim01w4ah9rb5i5/subgraphs/betr-contracts-base/1.1/gn';
const ROLE_THRESHOLD = 50_000_000; // 50M $MINTEDMERCH tokens
const WEI_DIVISOR = BigInt(10 ** 18);

// Optional: set VULCAN_WEBHOOK_SECRET in env vars and configure the same
// value in Vulcan's dashboard to prevent unauthorized requests.
const WEBHOOK_SECRET = process.env.VULCAN_WEBHOOK_SECRET;

function weiToTokens(weiString) {
  try {
    const wei = BigInt(weiString || '0');
    const whole = wei / WEI_DIVISOR;
    const remainder = wei % WEI_DIVISOR;
    return Number(whole) + Number(remainder) / 1e18;
  } catch {
    return 0;
  }
}

export async function POST(request) {
  try {
    // ── Optional secret validation ──────────────────────────────────────────
    if (WEBHOOK_SECRET) {
      const incoming = request.headers.get('x-vulcan-secret') ||
                       request.headers.get('authorization')?.replace('Bearer ', '');
      if (incoming !== WEBHOOK_SECRET) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    // ── Parse body ───────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    // Support both Vulcan payload shapes:
    //   { "wallet": "0x..." }          — single wallet
    //   { "wallets": ["0x...", ...] }  — multiple wallets
    let rawWallets = [];
    if (body.wallets && Array.isArray(body.wallets)) {
      rawWallets = body.wallets;
    } else if (body.wallet) {
      rawWallets = [body.wallet];
    } else {
      return Response.json({ success: false, error: 'Missing wallet or wallets field' }, { status: 400 });
    }

    // Normalize to lowercase and filter valid ETH addresses
    const wallets = rawWallets
      .filter(w => typeof w === 'string' && /^0x[0-9a-fA-F]{40}$/.test(w.trim()))
      .map(w => w.trim().toLowerCase());

    if (wallets.length === 0) {
      return Response.json({ success: false, error: 'No valid wallet addresses provided' }, { status: 400 });
    }

    console.log(`🎮 Vulcan role check for ${wallets.length} wallet(s): ${wallets.join(', ')}`);

    // ── Query Goldsky for current staked balances ────────────────────────────
    // stakerBalances may have multiple entries per wallet (one per stake/unstake event).
    // We take the entry with the highest timestamp_ per wallet as the current balance.
    const query = `
      query CheckStakedBalance($addresses: [String!]!) {
        stakerBalances(where: { staker_in: $addresses }, first: 1000) {
          staker
          balance
          timestamp_
        }
      }
    `;

    const gqlResponse = await fetch(GOLDSKY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { addresses: wallets } }),
    });

    if (!gqlResponse.ok) {
      console.error('Goldsky request failed:', gqlResponse.status);
      return Response.json({ success: false, error: 'Upstream data error' }, { status: 502 });
    }

    const gqlData = await gqlResponse.json();
    if (gqlData.errors) {
      console.error('Goldsky GraphQL errors:', gqlData.errors);
      return Response.json({ success: false, error: 'Upstream query error' }, { status: 502 });
    }

    const entries = gqlData.data?.stakerBalances || [];

    // Wallet has never touched the staking contract → 404
    if (entries.length === 0) {
      console.log(`🎮 Vulcan: wallet(s) not found in staking contract → 404`);
      return Response.json({ error: 'Wallet not found in staking contract' }, { status: 404 });
    }

    // Pick the most recent entry per wallet, then sum across all wallets
    const latestPerWallet = new Map();
    for (const entry of entries) {
      const wallet = entry.staker.toLowerCase();
      const ts = parseInt(entry.timestamp_ || '0');
      if (!latestPerWallet.has(wallet) || ts > latestPerWallet.get(wallet).ts) {
        latestPerWallet.set(wallet, { balance: weiToTokens(entry.balance), ts });
      }
    }

    const totalStaked = [...latestPerWallet.values()].reduce((sum, { balance }) => sum + balance, 0);
    const qualifies = totalStaked >= ROLE_THRESHOLD;

    console.log(`🎮 Vulcan: total staked = ${totalStaked.toLocaleString()} tokens → success: ${qualifies}`);

    return Response.json({ success: qualifies });

  } catch (error) {
    console.error('Error in Vulcan discord-role webhook:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
