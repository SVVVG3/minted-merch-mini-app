import { ImageResponse } from 'next/og';

// Use Node.js runtime as specified in Vercel docs
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber');

    if (!orderNumber) {
      throw new Error('Order number is required');
    }

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
            backgroundImage: 'linear-gradient(45deg, #000 0%, #1a1a1a 100%)',
            position: 'relative',
          }}
        >
          {/* Background Pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.1,
              backgroundImage: 'radial-gradient(circle at 50% 50%, #3eb489 1px, transparent 1px)',
              backgroundSize: '50px 50px',
            }}
          />
          
          {/* Success Icon */}
          <div
            style={{
              fontSize: '120px',
              marginBottom: '40px',
            }}
          >
            ✅
          </div>
          
          {/* Order Success Message */}
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            Order Confirmed!
          </div>
          
          {/* Order Number */}
          <div
            style={{
              fontSize: '24px',
              color: '#3eb489',
              marginBottom: '30px',
              fontWeight: 'bold',
            }}
          >
            Order #{orderNumber}
          </div>
          
          {/* Shop Info */}
          <div
            style={{
              fontSize: '20px',
              color: '#888',
              marginBottom: '10px',
            }}
          >
            🛒 Minted Merch Shop
          </div>
          
          <div
            style={{
              fontSize: '16px',
              color: '#888',
            }}
          >
            Paid with USDC on Base 🔵
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // Use 3:2 aspect ratio as required by Farcaster Mini Apps
        headers: {
          'Cache-Control': 'public, immutable, no-transform, max-age=3600',
          'Content-Type': 'image/png',
        },
      }
    );
  } catch (error) {
    console.error('Error generating order OG image:', error);
    
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
            Minted Merch Shop
          </div>
          <div style={{ fontSize: '18px', color: '#888', marginTop: '10px' }}>
            Order confirmation
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // Use 3:2 aspect ratio as required by Farcaster Mini Apps
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'image/png',
        },
      }
    );
  }
} 