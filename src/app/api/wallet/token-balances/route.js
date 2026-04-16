import { NextResponse } from 'next/server';

const NEYNAR_BASE_URL = 'https://api.neynar.com';
const USDC_ADDRESS_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

// spanDEX uses this canonical address for native ETH on EVM chains
const NATIVE_ETH_SPANDEX_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Neynar may return native ETH under the zero address or the EeeE address
function isNativeEth(address) {
  if (!address) return false;
  const lower = address.toLowerCase();
  return (
    lower === '0x0000000000000000000000000000000000000000' ||
    lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Neynar API key not configured' }, { status: 500 });
  }

  try {
    // Fetch first 100 token balances on Base for this wallet
    const url = new URL(`${NEYNAR_BASE_URL}/v2/onchain/token/balances`);
    url.searchParams.set('networks', 'base');
    url.searchParams.set('address', address);
    url.searchParams.set('limit', '100');

    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': apiKey },
      next: { revalidate: 30 }, // cache for 30s
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Neynar token balances error:', res.status, body);
      return NextResponse.json({ error: 'Failed to fetch token balances' }, { status: 502 });
    }

    const data = await res.json();

    // Normalize, filter, and sort
    const tokens = (data.balances ?? [])
      .map((t) => {
        const native = isNativeEth(t.address);
        return {
          symbol: t.symbol,
          name: t.name,
          // Normalize native ETH address to the canonical EeeE form for spanDEX
          address: native ? NATIVE_ETH_SPANDEX_ADDRESS : t.address,
          decimals: t.decimals,
          isNative: native,
          // Raw balance string (use for display), float USD for sorting
          balance: t.balance,
          balanceUsd: t.balance_usd ? parseFloat(t.balance_usd) : 0,
          priceUsd: t.price_usd ? parseFloat(t.price_usd) : 0,
          imageUrl: t.image_url ?? null,
          // Human-readable amount
          formatted: t.decimals != null
            ? (parseInt(t.balance, 10) / 10 ** t.decimals).toFixed(
                t.decimals <= 6 ? 4 : 6
              )
            : '0',
        };
      })
      // Exclude USDC — the output token (we're swapping TO it, not FROM it)
      .filter((t) => t.address.toLowerCase() !== USDC_ADDRESS_BASE)
      // Only show tokens with meaningful balance (≥ $0.01 USD value)
      .filter((t) => t.balanceUsd >= 0.01)
      // Filter out scam/spam tokens: these typically have absurdly inflated
      // prices (trillions of dollars per token) via price manipulation.
      // No legitimate token costs more than $1 M per unit (WBTC ≈ $100 k).
      // We also cap total displayed position value at $10 M — sufficient for
      // any real holding in a Farcaster mini-app context.
      .filter((t) => t.priceUsd <= 1_000_000 && t.balanceUsd <= 10_000_000)
      // Sort by USD value descending
      .sort((a, b) => b.balanceUsd - a.balanceUsd);

    return NextResponse.json({ tokens });
  } catch (err) {
    console.error('Wallet token balances error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
