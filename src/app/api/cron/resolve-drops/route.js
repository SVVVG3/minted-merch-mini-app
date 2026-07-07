/**
 * Hourly cron: resolve Limited Drops whose ends_at has passed.
 * Schedule in vercel.json: "1 * * * *" (minute 1 of every hour)
 */

import { NextResponse } from 'next/server';
import { resolveDueDrops } from '@/lib/dropResolve';

export const dynamic = 'force-dynamic';

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron')
    || request.headers.get('x-vercel-cron') === '1';

  if (isVercelCron) return true;
  if (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return false;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await resolveDueDrops();
    console.log(`[cron/resolve-drops] processed ${results.length} drop(s)`, results);
    return NextResponse.json({ success: true, resolved: results.length, results });
  } catch (err) {
    console.error('[cron/resolve-drops] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
