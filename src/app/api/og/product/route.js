import { ImageResponse } from '@vercel/og';

// Use edge runtime for ImageResponse compatibility
export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'Product';
  const price = searchParams.get('price') || '0.00';
  
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: 100 }}>📦</div>
        <div style={{ fontSize: 48, marginTop: 20 }}>{title}</div>
        <div style={{ fontSize: 36, color: '#3eb489', marginTop: 20 }}>${price}</div>
        <div style={{ fontSize: 24, color: '#888', marginTop: 20 }}>Minted Merch Shop</div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
} 