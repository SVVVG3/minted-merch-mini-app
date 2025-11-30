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
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const stakedAmount = searchParams.get('staked') || '0';
    
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
    
    // Fetch logo image
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(`${baseUrl}/logo.png`);
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
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Main Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              maxWidth: '900px',
            }}
          >
            {/* Logo */}
            {logoImageSrc && (
              <img
                src={logoImageSrc}
                alt="Minted Merch"
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'contain',
                  marginBottom: '30px',
                }}
              />
            )}
            
            {/* Title */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: '#3eb489',
                marginBottom: '30px',
                textTransform: 'uppercase',
              }}
            >
              STAKE TO EARN $mintedmerch
            </div>
            
            {/* Subtitle */}
            <div
              style={{
                fontSize: '28px',
                color: '#ffffff',
                marginBottom: '40px',
                lineHeight: '1.4',
                maxWidth: '800px',
              }}
            >
              Where Staking Meets Merch! Stake 50M+ $mintedmerch to unlock exclusive benefits!
            </div>
            
            {/* Benefits Box */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(62, 180, 137, 0.15)',
                border: '2px solid #3eb489',
                borderRadius: '20px',
                padding: '30px 50px',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '24px', color: '#3eb489', marginBottom: '15px' }}>
                🎁 Collab Partnerships • Custom Orders • Chat Access • 15% Off
              </div>
              <div style={{ fontSize: '20px', color: '#888' }}>
                Spin daily for merch packs & $mintedmerch rewards!
              </div>
            </div>
          </div>
          
          {/* Username badge if provided */}
          {username && (
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                left: '30px',
                backgroundColor: 'rgba(62, 180, 137, 0.2)',
                border: '2px solid #3eb489',
                borderRadius: '12px',
                padding: '15px 25px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '20px', color: '#3eb489' }}>
                @{username} • {stakedAmount} staked
              </span>
            </div>
          )}
          
          {/* Logo watermark in bottom right */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px',
              fontSize: '18px',
              color: '#3eb489',
              opacity: 0.7,
            }}
          >
            app.mintedmerch.shop/stake
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('OG Stake Error:', error);
    
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
          <div style={{ fontSize: 80, color: '#3eb489' }}>💰</div>
          <div style={{ fontSize: 48, marginTop: 20, color: '#3eb489' }}>STAKE TO EARN</div>
          <div style={{ fontSize: 32, color: '#3eb489', marginTop: 20 }}>$mintedmerch</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
}

