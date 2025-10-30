import { NextResponse } from 'next/server';
import { getCollections, getCollectionByHandle } from '@/lib/shopify';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (handle) {
      const collection = await getCollectionByHandle(handle);
      return NextResponse.json(collection);
    } else {
      const collections = await getCollections();
      return NextResponse.json(collections);
    }
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}