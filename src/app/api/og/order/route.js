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
    
    // Fetch logo image
    const logoUrl = 'https://mintedmerch.vercel.app/logo.png';
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(logoUrl);
    } catch (error) {
      console.error('Error fetching logo:', error);
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
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Centered Content Container - Larger Scale */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '80px',
              width: '100%',
              height: '100%',
            }}
          >
            {/* Product Image Section - Larger */}
            <div
              style={{
                width: '450px',
                height: '450px',
                borderRadius: '24px',
                backgroundColor: '#2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #3eb489',
                overflow: 'hidden',
                flexShrink: 0,
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
                  <div style={{ fontSize: '120px', marginBottom: '20px', color: '#3eb489' }}>✅</div>
                  <div style={{ fontSize: '32px', color: '#3eb489' }}>Order Complete!</div>
                </div>
              )}
            </div>
            
            {/* Order Info Section - Larger */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                maxWidth: '500px',
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  marginBottom: '30px',
                  lineHeight: '1.1',
                  color: '#3eb489',
                }}
              >
                Order Complete!
              </div>
              
              <div
                style={{
                  fontSize: '40px',
                  fontWeight: 'bold',
                  marginBottom: '25px',
                  color: 'white',
                }}
              >
                {orderNumber}
              </div>
              
              <div
                style={{
                  fontSize: '28px',
                  marginBottom: '25px',
                  lineHeight: '1.3',
                  color: 'white',
                }}
              >
                {products}
              </div>
              
              <div
                style={{
                  fontSize: '36px',
                  color: '#3eb489',
                  fontWeight: 'bold',
                  marginBottom: '40px',
                }}
              >
                {totalText}
              </div>
              
              <div
                style={{
                  fontSize: '20px',
                  color: '#888',
                }}
              >
                Paid with USDC on Base 🔵
              </div>
            </div>
          </div>
          
          {/* Logo in Bottom Right Corner - Doubled Size */}
          {logoImageSrc && (
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                right: '30px',
                width: '160px',
                height: '160px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <img
                src={logoImageSrc}
                alt="Minted Merch"
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
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