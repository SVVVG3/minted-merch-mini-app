import { ImageResponse } from 'next/og';

// Use edge runtime for ImageResponse compatibility
export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'Product';
  const price = searchParams.get('price') || '0.00';
  
  return new Response(`OG endpoint working! Title: ${title}, Price: ${price}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
} 