import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getMockupTaskResult } from '@/lib/printfulMockup';
import { uploadUrlToR2 } from '@/lib/r2Storage';

export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskKey = searchParams.get('task_key');

  if (!taskKey) {
    return NextResponse.json({ error: 'task_key is required' }, { status: 400 });
  }

  try {
    const result = await getMockupTaskResult(taskKey);

    if (result.status === 'pending') {
      return NextResponse.json({ status: 'pending' });
    }

    if (result.status === 'failed') {
      console.error(`❌ Mockup task failed for FID ${auth.fid}:`, result.error);
      return NextResponse.json({ status: 'failed', error: result.error || 'Mockup generation failed' });
    }

    if (result.status === 'completed' && result.mockups?.length > 0) {
      // Use the first mockup (front placement)
      const printfulUrl = result.mockups[0].mockup_url;

      // Download from Printful's temporary URL and store permanently in R2
      const shortKey = taskKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
      const r2Key = `mockups/${auth.fid}-${shortKey}-${Date.now()}.png`;
      const permanentUrl = await uploadUrlToR2(printfulUrl, r2Key);

      console.log(`✅ Mockup stored in R2 — FID: ${auth.fid}, key: ${r2Key}`);

      return NextResponse.json({ status: 'completed', mockupUrl: permanentUrl });
    }

    // Catch-all for unexpected status
    return NextResponse.json({ status: result.status || 'unknown' });
  } catch (error) {
    console.error('Task status check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
