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
    const title = searchParams.get('title') || 'Product';
    const price = searchParams.get('price') || '0.00';
    const imageUrl = searchParams.get('image');
    const priceText = '$' + price;
    
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
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            padding: '60px',
          }}
        >
          {/* Product Image Section */}
          <div
            style={{
              width: '400px',
              height: '400px',
              borderRadius: '20px',
              marginRight: '60px',
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
                alt={title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={{ fontSize: '120px', color: '#3eb489' }}>📦</div>
            )}
          </div>
          
          {/* Product Info Section */}
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
              {priceText}
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
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('OG Error:', error);
    
    // Return fallback image without external content
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
          <div style={{ fontSize: 100 }}>📦</div>
          <div style={{ fontSize: 48, marginTop: 20 }}>Product</div>
          <div style={{ fontSize: 36, color: '#3eb489', marginTop: 20 }}>Minted Merch</div>
          <div style={{ fontSize: 24, color: '#888', marginTop: 20 }}>Error loading image</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 