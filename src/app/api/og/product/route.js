import { ImageResponse } from 'next/og';

// Use Node.js runtime as specified in Vercel docs
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');
    
    // Get product data from URL parameters (passed from the frontend)
    const title = searchParams.get('title') || 'Product';
    const price = searchParams.get('price') || '0.00';
    const imageUrl = searchParams.get('image');
    
    // Load external image using fetch as shown in Vercel docs
    let productImage = null;
    if (imageUrl) {
      try {
        const imageResponse = await fetch(imageUrl);
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          productImage = arrayBuffer;
        }
      } catch (error) {
        console.log('Failed to load external image:', error);
      }
    }
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#1a1a1a',
            color: 'white',
            padding: '60px',
          }}
        >
          {/* Product Image or Icon */}
          <div
            style={{
              width: '400px',
              height: '400px',
              borderRadius: '20px',
              marginRight: '60px',
              backgroundColor: productImage ? 'white' : '#2a2a2a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #3eb489',
              overflow: 'hidden',
            }}
          >
            {productImage ? (
              <img
                src={imageUrl}
                alt={title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{ fontSize: '120px', color: '#3eb489' }}>
                📦
              </div>
            )}
          </div>
          
          {/* Product Info */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                marginBottom: '20px',
                lineHeight: '1.2',
              }}
            >
              {title}
            </div>
            
            <div
              style={{
                fontSize: '36px',
                color: '#3eb489',
                fontWeight: 'bold',
                marginBottom: '30px',
              }}
            >
              ${parseFloat(price).toFixed(2)}
            </div>
            
            <div
              style={{
                fontSize: '24px',
                color: '#888',
                marginBottom: '20px',
              }}
            >
              🛒 Minted Merch Shop
            </div>
            
            <div
              style={{
                fontSize: '18px',
                color: '#888',
                marginBottom: '20px',
              }}
            >
              Shop crypto merch with instant payments
            </div>
            
            <div
              style={{
                fontSize: '16px',
                color: '#3eb489',
              }}
            >
              Pay with USDC on Base 🔵
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // Use 3:2 aspect ratio as required by Farcaster Mini Apps
        headers: {
          'Cache-Control': 'public, immutable, no-transform, max-age=300',
          'Content-Type': 'image/png',
        },
      }
    );
    
  } catch (error) {
    console.error('Error generating OG image:', error);
    
    // Fallback error image
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
            Crypto merch with USDC payments
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