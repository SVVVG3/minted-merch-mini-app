import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('order');
    const total = searchParams.get('total');
    const products = searchParams.get('products'); // New: product names for the order

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
              backgroundImage: `radial-gradient(circle at 25px 25px, #3eb489 2px, transparent 0), radial-gradient(circle at 75px 75px, #3eb489 2px, transparent 0)`,
              backgroundSize: '100px 100px',
              opacity: 0.1,
            }}
          />

          {/* Main Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '90%',
              maxWidth: '800px',
              padding: '60px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '20px',
              border: '1px solid rgba(62, 180, 137, 0.3)',
              textAlign: 'center',
            }}
          >
            {/* Success Icon */}
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '60px',
                backgroundColor: '#3eb489',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '30px',
              }}
            >
              <div
                style={{
                  fontSize: '60px',
                  color: 'white',
                }}
              >
                ✓
              </div>
            </div>

            {/* Success Message */}
            <div
              style={{
                fontSize: '48px',
                fontWeight: '800',
                color: 'white',
                marginBottom: '20px',
              }}
            >
              Order Confirmed! 🎉
            </div>

            {/* Product Names (if provided) */}
            {products && (
              <div
                style={{
                  fontSize: '24px',
                  color: '#ccc',
                  marginBottom: '15px',
                  textAlign: 'center',
                  maxWidth: '600px',
                  lineHeight: '1.3',
                }}
              >
                {decodeURIComponent(products)}
              </div>
            )}

            {/* Order Details */}
            <div
              style={{
                fontSize: '24px',
                color: '#888',
                marginBottom: '10px',
              }}
            >
              Order {orderNumber}
            </div>

            {total && (
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: '#3eb489',
                  marginBottom: '30px',
                }}
              >
                ${total} USDC
              </div>
            )}

            {/* Call to Action */}
            <div
              style={{
                fontSize: '20px',
                color: '#ccc',
                marginBottom: '20px',
              }}
            >
              Paid instantly on Base 🔵
            </div>

            {/* Brand */}
            <div
              style={{
                fontSize: '28px',
                fontWeight: '600',
                color: '#3eb489',
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Minted Merch
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              fontSize: '16px',
              color: '#888',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div>Shop crypto merch • Pay with USDC • Powered by Farcaster</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio as required by Mini Apps
        headers: {
          // Follow Farcaster dynamic image caching recommendations
          'Cache-Control': 'public, immutable, no-transform, max-age=3600',
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      },
    );
  } catch (error) {
    console.error('Error generating order OG image:', error);
    
    // Return a fallback image
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
          }}
        >
          <div style={{ fontSize: '48px', fontWeight: '800' }}>
            Order Confirmed! 🎉
          </div>
          <div style={{ fontSize: '24px', color: '#3eb489', marginTop: '20px' }}>
            Minted Merch • Crypto Merch • USDC
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio as required by Mini Apps
        headers: {
          // Short cache for fallback images to prevent error caching
          'Cache-Control': 'public, no-transform, max-age=60',
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      },
    );
  }
} 