import { ImageResponse } from '@vercel/og';

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
            {/* Logo Section - Larger */}
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
              {logoImageSrc ? (
                <img
                  src={logoImageSrc}
                  alt="Minted Merch"
                  style={{
                    width: '300px',
                    height: '300px',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div style={{ fontSize: '120px', color: '#3eb489' }}>🛒</div>
              )}
            </div>
            
            {/* Brand Info Section - Larger */}
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
                  fontSize: '72px',
                  fontWeight: 'bold',
                  marginBottom: '30px',
                  lineHeight: '1.1',
                  color: '#3eb489',
                }}
              >
                Minted Merch
              </div>
              
              <div
                style={{
                  fontSize: '28px',
                  color: 'white',
                  marginBottom: '25px',
                  lineHeight: '1.3',
                }}
              >
                Shop apparel, accessories, & more - designed after your favorite coins, communities, & NFTs!
              </div>
              
              <div
                style={{
                  fontSize: '24px',
                  color: '#3eb489',
                  marginBottom: '20px',
                }}
              >
                Pay with USDC on Base 🔵
              </div>
              
              <div
                style={{
                  fontSize: '20px',
                  color: '#888',
                }}
              >
                Instant payments • Premium quality
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
          <div style={{ fontSize: 100, color: '#3eb489' }}>🛒</div>
          <div style={{ fontSize: 48, marginTop: 20, color: '#3eb489' }}>Minted Merch</div>
          <div style={{ fontSize: 32, color: 'white', marginTop: 20 }}>Shop apparel, accessories, & more!</div>
          <div style={{ fontSize: 24, color: '#888', marginTop: 20 }}>Premium crypto merchandise</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 