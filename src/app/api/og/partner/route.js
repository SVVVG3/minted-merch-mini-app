import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
    
    // Fetch the Partner logo
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(`${baseUrl}/MintedMerchPartnerLogo.png`);
    } catch (error) {
      console.error('Error fetching partner logo:', error);
    }
    
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
            position: 'relative',
          }}
        >
          
          {/* Main Logo - sized to fit properly */}
          {logoImageSrc ? (
            <img
              src={logoImageSrc}
              alt="Minted Merch Partner"
              style={{
                maxWidth: '70%',
                maxHeight: '45%',
                objectFit: 'contain',
              }}
            />
          ) : (
            // Fallback text if image doesn't load
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '64px',
                  fontWeight: 'bold',
                  color: '#3eb489',
                  marginBottom: '20px',
                }}
              >
                🤝 MINTED MERCH
              </div>
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  color: '#3eb489',
                }}
              >
                PARTNER
              </div>
            </div>
          )}
          
          {/* Tagline */}
          <div
            style={{
              marginTop: '40px',
              fontSize: '36px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '500',
              display: 'flex',
            }}
          >
            Process Orders • View Payouts
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630, // Standard OG image ratio (1.91:1)
      },
    );
    
  } catch (error) {
    console.error('OG Partner Error:', error);
    
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
          }}
        >
          <div style={{ fontSize: 64, color: '#3eb489', fontWeight: 'bold' }}>🤝 MINTED MERCH</div>
          <div style={{ fontSize: 56, color: '#3eb489', marginTop: 20, fontWeight: 'bold' }}>PARTNER</div>
          <div style={{ fontSize: 36, color: 'rgba(255,255,255,0.9)', marginTop: 40 }}>Process Orders • View Payouts</div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  }
}

