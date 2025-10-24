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
          <div style={{ fontSize: '24px', color: '#3eb489', marginTop: '20px' }}>
            Test Image Working!
          </div>
          <div style={{ fontSize: '18px', color: '#888', marginTop: '10px' }}>
            {new Date().toISOString()}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'image/png',
        },
      }
    );
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
} 