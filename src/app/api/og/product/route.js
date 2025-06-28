import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
      throw new Error('Product handle is required');
    }

    // Convert handle to display title
    const productTitle = handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Create rich branded product card without external dependencies
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
            backgroundImage: 'linear-gradient(45deg, #1a1a1a 0%, #2d2d2d 100%)',
            fontFamily: 'Inter, sans-serif',
            position: 'relative',
            padding: '40px',
          }}
        >
          {/* Background pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'radial-gradient(circle at 25% 25%, #3eb489 0%, transparent 50%), radial-gradient(circle at 75% 75%, #3eb489 0%, transparent 50%)',
              opacity: 0.1,
            }}
          />
          
          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(62, 180, 137, 0.3)',
              borderRadius: '20px',
              padding: '60px',
              maxWidth: '900px',
              backdropFilter: 'blur(10px)',
              textAlign: 'center',
            }}
          >
            {/* Shopping cart icon */}
            <div
              style={{
                fontSize: '100px',
                marginBottom: '40px',
              }}
            >
              🛒
            </div>

            {/* Product title */}
            <h1
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: 'white',
                margin: '0 0 30px 0',
                lineHeight: '1.2',
                maxWidth: '700px',
              }}
            >
              {productTitle}
            </h1>

            {/* Price placeholder */}
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#3eb489',
                margin: '0 0 40px 0',
              }}
            >
              Pay with USDC
            </div>

            {/* Call to action */}
            <div
              style={{
                fontSize: '28px',
                color: '#cccccc',
                margin: '0 0 30px 0',
              }}
            >
              Shop crypto merch with instant payments
            </div>

            {/* Base logo/branding */}
            <div
              style={{
                fontSize: '24px',
                color: '#3eb489',
                fontWeight: 'bold',
              }}
            >
              Pay on Base 🔵
            </div>
          </div>

          {/* Minted Merch branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px',
              fontSize: '20px',
              color: '#888888',
              fontWeight: 'bold',
            }}
          >
            mintedmerch.shop
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio (1200:800 = 3:2) as required by Mini Apps
      }
    );

  } catch (error) {
    console.error('Error generating product image:', error);
    
    // Return branded error image
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
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>🛒</div>
          <div style={{ fontSize: '32px', color: 'white', marginBottom: '10px' }}>
            Minted Merch Shop
          </div>
          <div style={{ fontSize: '24px', color: '#3eb489' }}>
            Shop crypto merch with USDC on Base 🔵
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio (1200:800 = 3:2) as required by Mini Apps
      }
    );
  }
} 