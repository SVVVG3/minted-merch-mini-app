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
            fontSize: '48px',
            fontWeight: 'bold',
          }}
        >
          <div style={{ fontSize: '120px', marginBottom: '40px' }}>
            📦
          </div>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            {title}
          </div>
          <div style={{ fontSize: '36px', color: '#3eb489', marginBottom: '30px' }}>
            ${parseFloat(price).toFixed(2)}
          </div>
          <div style={{ fontSize: '24px', color: '#888' }}>
            Minted Merch Shop
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );
    
  } catch (error) {
    console.error('Error generating OG image:', error);
    
    // Return a simple fallback
    return new Response('Error generating image', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
} 