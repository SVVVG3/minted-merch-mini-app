import { ImageResponse } from 'next/og';
import { withAdminAuth } from '@/lib/adminAuth';

export const runtime = 'edge';

export async function GET() {
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
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
          }}
        >
          <div>🛒</div>
          <div>Test OG Image</div>
          <div style={{ fontSize: '24px', color: '#3eb489' }}>
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
    console.error('Error generating test image:', error);
    return new Response('Error generating image', { status: 500 });
  }
} 