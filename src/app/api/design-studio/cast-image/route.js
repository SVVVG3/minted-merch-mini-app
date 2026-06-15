import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';

/**
 * GET /api/design-studio/cast-image?hash=0x...
 *
 * Looks up a Farcaster cast by hash via Neynar and returns the first image
 * URL found in its embeds. Used by CreatePageClient when the app is opened
 * via the castShareUrl feature (sdk.context.cast provides the hash but not
 * the full embed data).
 */
export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');
  if (!hash) {
    return NextResponse.json({ error: 'hash is required' }, { status: 400 });
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Neynar not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(hash)}&type=hash`,
      { headers: { 'x-api-key': apiKey } }
    );
    const data = await res.json();
    const cast = data?.cast || data?.result?.cast;

    if (!cast) {
      console.warn(`cast-image: cast not found for hash ${hash}`);
      return NextResponse.json({ imageUrl: null });
    }

    const embeds = cast.embeds || [];
    const imageEmbed = embeds.find(e => e.url && isImageUrl(e.url));

    console.log(
      `🎨 cast-image lookup — hash: ${hash}, embeds: ${embeds.length}, found: ${imageEmbed?.url || 'none'}`
    );

    return NextResponse.json({ imageUrl: imageEmbed?.url || null });
  } catch (err) {
    console.error('cast-image error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function isImageUrl(url) {
  try {
    const u = new URL(url);
    const ext = u.pathname.split('.').pop()?.toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(ext)) return true;
    const imageCdns = [
      'imagedelivery.net', 'i.imgur.com', 'imgur.com', 'i.redd.it',
      'pbs.twimg.com', 'cdn.discordapp.com', 'media.discordapp.net',
      'ipfs.io', 'cloudflare-ipfs.com', 'nft-cdn.alchemy.com', 'res.cloudinary.com',
    ];
    return imageCdns.some(cdn => u.hostname.includes(cdn));
  } catch { return false; }
}
