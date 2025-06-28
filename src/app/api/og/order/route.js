import { ImageResponse } from '@vercel/og';

// Use edge runtime for ImageResponse compatibility
export const runtime = 'nodejs';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber') || 'ORDER-123';
    const total = searchParams.get('total') || '0.00';
    const products = searchParams.get('products') || 'crypto merch';
    const itemCount = parseInt(searchParams.get('itemCount') || '1');
    const imageUrl = searchParams.get('image');
    
    const totalText = parseFloat(total).toFixed(2) + ' USDC';
    
    // Fetch and convert external image if provided
    let productImageSrc = null;
    if (imageUrl) {
      productImageSrc = await fetchImageAsDataUrl(imageUrl);
    }
    
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            padding: '40px',
          }}
        >
          {/* Centered Content Container */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '50px',
            }}
          >
            {/* Product Image Section */}
            <div
              style={{
                width: '350px',
                height: '350px',
                borderRadius: '20px',
                backgroundColor: '#2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #3eb489',
                overflow: 'hidden',
              }}
            >
              {productImageSrc ? (
                <img
                  src={productImageSrc}
                  alt={products}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '80px', marginBottom: '10px', color: '#3eb489' }}>✅</div>
                  <div style={{ fontSize: '24px', color: '#3eb489' }}>Order Complete!</div>
                </div>
              )}
            </div>
            
            {/* Order Info Section */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                maxWidth: '400px',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  marginBottom: '20px',
                  lineHeight: '1.2',
                  color: '#3eb489',
                }}
              >
                Order Complete!
              </div>
              
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  marginBottom: '20px',
                  color: 'white',
                }}
              >
                {orderNumber}
              </div>
              
              <div
                style={{
                  fontSize: '24px',
                  marginBottom: '20px',
                  lineHeight: '1.3',
                }}
              >
                {products}
              </div>
              
              <div
                style={{
                  fontSize: '28px',
                  color: '#3eb489',
                  fontWeight: 'bold',
                  marginBottom: '30px',
                }}
              >
                {totalText}
              </div>
              
              <div
                style={{
                  fontSize: '20px',
                  color: '#888',
                  marginBottom: '15px',
                }}
              >
                🛒 Minted Merch Shop
              </div>
              
              <div
                style={{
                  fontSize: '16px',
                  color: '#3eb489',
                }}
              >
                Paid with USDC on Base 🔵
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('OG Error:', error);
    
    // Return fallback image
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
          <div style={{ fontSize: 100, color: '#3eb489' }}>✅</div>
          <div style={{ fontSize: 48, marginTop: 20 }}>Order Complete!</div>
          <div style={{ fontSize: 36, color: '#3eb489', marginTop: 20 }}>Minted Merch</div>
          <div style={{ fontSize: 24, color: '#888', marginTop: 20 }}>Error loading order details</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 