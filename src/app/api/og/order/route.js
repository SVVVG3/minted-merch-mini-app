import { ImageResponse } from '@vercel/og';

// Use edge runtime for ImageResponse compatibility
export const runtime = 'nodejs';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    console.log('Fetching image from URL:', imageUrl);
    const response = await fetch(imageUrl);
    console.log('Image fetch response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log('Image fetched successfully, content-type:', contentType, 'size:', buffer.length);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching image from', imageUrl, ':', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber') || 'ORDER-123';
    const total = searchParams.get('total') || '0.00';
    // Support both old 'products' param and new 'product' param
    const product = searchParams.get('product') || searchParams.get('products') || '1 item';
    
    console.log('=== OG Order Image Generation ===');
    console.log('Raw params:', { orderNumber, total, product });
    
    // Fix order number formatting - remove URL encoding and ensure single #
    let displayOrderNumber = decodeURIComponent(orderNumber);
    // Remove any double ## that might have been added
    displayOrderNumber = displayOrderNumber.replace(/^#+/, '#');
    
    console.log('Processed values:', { displayOrderNumber, product });
    
    // Fetch logo image with better error handling
    const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
    let logoImageSrc = null;
    try {
      console.log('Fetching logo from:', logoUrl);
      logoImageSrc = await fetchImageAsDataUrl(logoUrl);
      console.log('Logo fetch result:', logoImageSrc ? '✅ Success' : '❌ Failed');
    } catch (error) {
      console.error('❌ Error fetching logo:', error);
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
            backgroundColor: '#000000',
            backgroundImage: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
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
            {/* Order Success Icon Section */}
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
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                <div style={{ fontSize: '120px', marginBottom: '20px', color: '#3eb489' }}>✅</div>
                <div style={{ fontSize: '32px', color: '#3eb489' }}>Order Complete!</div>
              </div>
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
                  fontSize: '28px',
                  marginBottom: '20px',
                  lineHeight: '1.3',
                  color: 'white',
                }}
              >
                {product}
              </div>
              
              <div
                style={{
                  fontSize: '20px',
                  color: '#3eb489',
                  lineHeight: '1.3',
                }}
              >
                Shop using 1200+ coins across 20+ chains ✨
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
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
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
            backgroundColor: '#000000',
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
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      },
    );
  }
} 