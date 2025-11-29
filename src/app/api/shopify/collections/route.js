import { NextResponse } from 'next/server';
import { getCollections, getCollectionByHandle } from '@/lib/shopify';

// Cache collections for 5 minutes on Vercel CDN to reduce function invocations
// Collections rarely change, so this is safe and will dramatically reduce API calls
const CACHE_HEADERS = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
  // s-maxage=300: Cache on Vercel CDN for 5 minutes
  // stale-while-revalidate=600: Serve stale data for up to 10 minutes while refreshing in background
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (handle) {
      const collection = await getCollectionByHandle(handle);
      return NextResponse.json(collection, { headers: CACHE_HEADERS });
    } else {
      const collections = await getCollections();
      return NextResponse.json(collections, { headers: CACHE_HEADERS });
    }
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}