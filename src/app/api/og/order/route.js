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
    const products = decodeURIComponent(searchParams.get('products') || '1 item');
    const itemCount = parseInt(searchParams.get('itemCount') || '1');
    const imageUrl = searchParams.get('image');
    const bustCache = searchParams.get('t'); // Cache busting parameter
    
    console.log('=== OG Order Image Generation ===');
    console.log('Raw params:', { orderNumber, total, products, itemCount, imageUrl, bustCache });
    console.log('Products parameter:', products);
    console.log('Products type:', typeof products);
    console.log('Products length:', products.length);
    console.log('Products includes newline:', products.includes('\n'));
    console.log('Products includes comma:', products.includes(','));
    
    // Fix order number formatting - remove URL encoding and ensure single #
    let displayOrderNumber = decodeURIComponent(orderNumber);
    // Remove any double ## that might have been added
    displayOrderNumber = displayOrderNumber.replace(/^#+/, '#');
    
    console.log('Processed values:', { displayOrderNumber, products });
    
    // Fetch and convert external image if provided
    let productImageSrc = null;
    let productImageFailed = false;
    
    if (imageUrl) {
      console.log('=== ATTEMPTING TO FETCH PRODUCT IMAGE ===');
      console.log('Image URL:', imageUrl);
      
      try {
        // Add timeout and retry logic for reliability
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced to 5 seconds
        
        const response = await fetch(imageUrl, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Minted-Merch-OG/1.0'
          }
        });
        clearTimeout(timeoutId);
        
        console.log('Image fetch response:', { 
          status: response.status, 
          statusText: response.statusText,
          contentType: response.headers.get('content-type')
        });
        
        if (response.ok && response.status === 200) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          
          console.log('✅ Image fetched successfully:', { 
            contentType, 
            size: buffer.length,
            sizeKB: Math.round(buffer.length / 1024)
          });
          
          productImageSrc = `data:${contentType};base64,${buffer.toString('base64')}`;
          console.log('✅ Data URL created, length:', productImageSrc.length);
        } else {
          console.error('❌ Image fetch failed:', response.status, response.statusText);
          productImageFailed = true;
        }
      } catch (error) {
        console.error('❌ Error fetching product image:', error.message);
        productImageFailed = true;
        if (error.name === 'AbortError') {
          console.error('❌ Image fetch timed out after 5 seconds');
        }
      }
    } else {
      console.log('ℹ️ No product image URL provided');
    }
    
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
    
    console.log('=== FINAL RENDER DECISION ===');
    console.log('Will show product image:', !!productImageSrc);
    console.log('Product image failed:', productImageFailed);
    console.log('Will show logo:', !!logoImageSrc);
    console.log('Image URL provided:', !!imageUrl);
    
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
                    textAlign: 'center',
                    padding: '20px',
                  }}
                >
                  {productImageFailed ? (
                    <>
                      <div style={{ fontSize: '80px', marginBottom: '20px', color: '#ff6b6b' }}>❌</div>
                      <div style={{ fontSize: '24px', color: '#ff6b6b', marginBottom: '10px' }}>Image Failed</div>
                      <div style={{ fontSize: '16px', color: '#888' }}>
                        {imageUrl ? 'Fetch Error' : 'No URL'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '120px', marginBottom: '20px', color: '#3eb489' }}>✅</div>
                      <div style={{ fontSize: '32px', color: '#3eb489' }}>Order Complete!</div>
                    </>
                  )}
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
                  fontSize: '28px',
                  marginBottom: '40px',
                  lineHeight: '1.3',
                  color: 'white',
                }}
              >
                {products}
              </div>
              
              <div
                style={{
                  fontSize: '20px',
                  color: '#3eb489',
                }}
              >
                Paid with USDC on Base 🟦
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