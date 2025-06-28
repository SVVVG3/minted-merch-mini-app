import { ImageResponse } from 'next/og';

// Use edge runtime for ImageResponse compatibility
export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'Product';
    const price = searchParams.get('price') || '0.00';
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '120px' }}>📦</div>
          <div style={{ fontSize: '48px', color: 'white' }}>{title}</div>
          <div style={{ fontSize: '36px', color: '#3eb489' }}>${price}</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );
    
  } catch (error) {
    console.error('OG Error:', error);
    
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
} 