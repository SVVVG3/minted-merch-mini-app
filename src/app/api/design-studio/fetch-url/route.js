import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { uploadUrlToR2 } from '@/lib/r2Storage';

// Re-upload an external image URL to R2 so Printful can always fetch it.
// Used for Farcaster profile pictures which may be on CDNs Printful can't access.
export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    // Validate it looks like a URL
    new URL(url);

    const r2Key = `user-designs/${auth.fid}-pfp-${Date.now()}.jpg`;
    const r2Url = await uploadUrlToR2(url, r2Key);

    console.log(`📥 PFP re-uploaded to R2 for FID ${auth.fid}: ${r2Key}`);
    return NextResponse.json({ success: true, url: r2Url });
  } catch (error) {
    console.error('Fetch-URL error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
