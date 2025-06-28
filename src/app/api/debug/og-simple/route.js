import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
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
            backgroundColor: '#000',
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
          }}
        >
          <div style={{ fontSize: '72px', marginBottom: '20px' }}>🛒</div>
          <div style={{ color: '#3eb489' }}>Minted Merch Shop</div>
          <div style={{ fontSize: '24px', color: '#888', marginTop: '20px' }}>
            Test Image Generation
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );
  } catch (error) {
    console.error('Error generating simple OG image:', error);
    return new Response('Error generating image', { status: 500 });
  }
} 