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
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
    
    // Fetch the custom staking embed image
    let stakingImageSrc = null;
    try {
      stakingImageSrc = await fetchImageAsDataUrl(`${baseUrl}/StakingEmbedImage.png`);
    } catch (error) {
      console.error('Error fetching staking image:', error);
    }
    
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
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            position: 'relative',
          }}
        >
          {/* Main Staking Image - Centered */}
          {stakingImageSrc ? (
            <img
              src={stakingImageSrc}
              alt="Stake $MINTEDMERCH"
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                objectFit: 'contain',
              }}
            />
          ) : (
            // Fallback if image doesn't load
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
                  marginBottom: '30px',
                  textTransform: 'uppercase',
                }}
              >
                STAKE TO EARN
              </div>
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  color: '#3eb489',
                }}
              >
                $MINTEDMERCH
              </div>
            </div>
          )}
          
          {/* Logo in Bottom Right Corner */}
          {logoImageSrc && (
            <div
              style={{
                position: 'absolute',
                bottom: '40px',
                right: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
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
                    width: '60px',
                    height: '60px',
                    objectFit: 'contain',
                  }}
                />
              </div>
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
          <div style={{ fontSize: 72, color: '#3eb489', fontWeight: 'bold' }}>STAKE TO EARN</div>
          <div style={{ fontSize: 56, color: '#3eb489', marginTop: 20 }}>$MINTEDMERCH</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
}
