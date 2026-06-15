import { NextResponse } from 'next/server';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');

/**
 * Farcaster Cast Action — Design on Minted Merch
 *
 * GET  → Returns action metadata so Farcaster clients can install it.
 *        Install URL: https://app.mintedmerch.shop/api/design-studio/cast-action
 *
 * POST → Called by Farcaster when a user triggers the action on a cast.
 *        Looks up the cast via Neynar, finds the first image embed, and
 *        returns a frame URL that opens the Design Studio with that image
 *        pre-loaded.
 */

export async function GET() {
  return NextResponse.json({
    name: 'Design on Minted Merch',
    icon: 'paintbrush',
    description: 'Apply this image to custom merch in the Minted Merch Design Studio',
    aboutUrl: `${BASE_URL}/create`,
    action: { type: 'post' },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const castHash = body?.untrustedData?.castId?.hash;

    if (!castHash) {
      return NextResponse.json({ message: 'No cast information found.' });
    }

    // Look up the cast via Neynar to get its embeds
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      console.error('NEYNAR_API_KEY not configured');
      return NextResponse.json({ message: 'Server configuration error.' });
    }

    const neynarRes = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(castHash)}&type=hash`,
      { headers: { 'x-api-key': apiKey } }
    );
    const neynarData = await neynarRes.json();
    const cast = neynarData?.cast || neynarData?.result?.cast;

    if (!cast) {
      console.error('Cast not found for hash:', castHash, neynarData);
      return NextResponse.json({ message: 'Cast not found. Please try again.' });
    }

    console.log(
      `🎨 Cast action triggered — hash: ${castHash}, embeds: ${JSON.stringify(cast.embeds)}`
    );

    // Find the first image URL in the cast's embeds
    const embeds = cast.embeds || [];
    const imageEmbed = embeds.find(e => e.url && isImageUrl(e.url));

    if (!imageEmbed) {
      return NextResponse.json({
        message: "No image found in this cast. Try using it on a cast that contains an image.",
      });
    }

    const frameUrl = `${BASE_URL}/create?castImageUrl=${encodeURIComponent(imageEmbed.url)}`;
    console.log(`🎨 Opening Design Studio with cast image: ${imageEmbed.url}`);

    return NextResponse.json({ type: 'frame', frameUrl });
  } catch (error) {
    console.error('Cast action error:', error);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' });
  }
}

/**
 * Detect whether a URL points to an image, either by file extension
 * or by hostname (known image CDNs / hosting services).
 */
function isImageUrl(url) {
  try {
    const u = new URL(url);
    const ext = u.pathname.split('.').pop()?.toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(ext)) return true;

    const imageCdns = [
      'imagedelivery.net',   // Cloudflare Images (Warpcast)
      'i.imgur.com',
      'imgur.com',
      'i.redd.it',
      'pbs.twimg.com',       // Twitter/X image CDN
      'cdn.discordapp.com',
      'media.discordapp.net',
      'ipfs.io',
      'cloudflare-ipfs.com',
      'nft-cdn.alchemy.com',
      'res.cloudinary.com',
    ];
    if (imageCdns.some(cdn => u.hostname.includes(cdn))) return true;

    return false;
  } catch {
    return false;
  }
}
