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

export async function GET() {
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
    
    // Fetch the Follow Mission logo
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(`${baseUrl}/MintedMerchMissionsLogo.png`);
    } catch (error) {
      console.error('Error fetching follow mission logo:', error);
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
          {/* Background gradient overlay */}
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

          {/* Logo Image */}
          {logoImageSrc ? (
            <img
              src={logoImageSrc}
              alt="Follow Mission"
              style={{
                maxWidth: '70%',
                maxHeight: '45%',
                objectFit: 'contain',
                marginBottom: '30px',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: '#ffffff',
                textAlign: 'center',
                marginBottom: '30px',
                display: 'flex',
              }}
            >
              Follow Mission
            </div>
          )}

          {/* Green subtitle text only */}
          <div
            style={{
              fontSize: '32px',
              color: '#3eb489',
              textAlign: 'center',
              maxWidth: '800px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ display: 'flex' }}>Follow @mintedmerch • Join /mintedmerch</span>
            <span style={{ display: 'flex', marginTop: '10px' }}>Enable Notifications • Claim Reward!</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG Follow Error:', error);

    // Fallback
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
          <div
            style={{
              fontSize: '32px',
              color: '#3eb489',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ display: 'flex' }}>Follow @mintedmerch • Join /mintedmerch</span>
            <span style={{ display: 'flex', marginTop: '10px' }}>Enable Notifications • Claim Reward!</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}

