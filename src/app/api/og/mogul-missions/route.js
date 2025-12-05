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
    
    // Fetch the Merch Mogul Missions logo
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(`${baseUrl}/MerchMogulMissionsDashboardLogo.png`);
    } catch (error) {
      console.error('Error fetching mogul missions logo:', error);
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
            // Black gradient background
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            position: 'relative',
          }}
        >
          {/* Subtle gradient overlay for depth */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(ellipse at center, rgba(62, 180, 137, 0.15) 0%, transparent 70%)',
              display: 'flex',
            }}
          />
          
          {/* Main Logo */}
          {logoImageSrc ? (
            <img
              src={logoImageSrc}
              alt="Merch Mogul Missions"
              style={{
                maxWidth: '85%',
                maxHeight: '60%',
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
                  fontSize: '72px',
                  fontWeight: 'bold',
                  color: '#3eb489',
                  marginBottom: '20px',
                }}
              >
                💎 MERCH MOGUL
              </div>
              <div
                style={{
                  fontSize: '64px',
                  fontWeight: 'bold',
                  color: '#3eb489',
                }}
              >
                MISSIONS
              </div>
            </div>
          )}
          
          {/* Tagline */}
          <div
            style={{
              marginTop: '30px',
              fontSize: '32px',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '500',
              display: 'flex',
            }}
          >
            Complete bounties • Earn $mintedmerch
          </div>
          
          {/* Bottom badge */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'rgba(62, 180, 137, 0.2)',
              borderRadius: '50px',
              padding: '12px 24px',
              border: '2px solid rgba(62, 180, 137, 0.5)',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                color: '#3eb489',
                fontWeight: 'bold',
                display: 'flex',
              }}
            >
              50M+ $mintedmerch holders only
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630, // Standard OG image ratio (1.91:1)
      },
    );
    
  } catch (error) {
    console.error('OG Mogul Missions Error:', error);
    
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
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 72, color: '#3eb489', fontWeight: 'bold' }}>💎 MERCH MOGUL</div>
          <div style={{ fontSize: 64, color: '#3eb489', marginTop: 20, fontWeight: 'bold' }}>MISSIONS</div>
          <div style={{ fontSize: 32, color: 'rgba(255,255,255,0.8)', marginTop: 30 }}>Complete bounties • Earn $mintedmerch</div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  }
}

