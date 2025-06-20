import { NextResponse } from 'next/server';
import { getProductByHandle } from '@/lib/shopify';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
      return NextResponse.json({ error: 'Product handle is required' }, { status: 400 });
    }

    const product = await getProductByHandle(handle);
    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}