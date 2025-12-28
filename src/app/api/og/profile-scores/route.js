import { ImageResponse } from 'next/og';

export const runtime = 'edge';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Generator/1.0)',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const username = searchParams.get('username') || 'User';
    const pfpUrl = searchParams.get('pfpUrl');
    const neynarScore = searchParams.get('neynar') || '0.00';
    const quotientScore = searchParams.get('quotient') || '0.00';
    const mojoScore = searchParams.get('mojo') || '0.00';
    
    // Format scores to 2 decimal places
    const formattedNeynar = parseFloat(neynarScore).toFixed(2);
    const formattedQuotient = parseFloat(quotientScore).toFixed(2);
    const formattedMojo = parseFloat(mojoScore).toFixed(2);
    
    // Color coding for scores
    const getNeynarColor = (score) => {
      const s = parseFloat(score);
      if (s >= 0.9) return '#22c55e'; // green
      if (s >= 0.6) return '#eab308'; // yellow
      return '#ef4444'; // red
    };
    
    const getQuotientColor = (score) => {
      const s = parseFloat(score);
      if (s >= 0.9) return '#a855f7'; // purple
      if (s >= 0.8) return '#3b82f6'; // blue
      if (s >= 0.7) return '#22c55e'; // green
      if (s >= 0.5) return '#eab308'; // yellow
      return '#ef4444'; // red
    };
    
    const getMojoColor = (score) => {
      const s = parseFloat(score);
      if (s >= 0.5) return '#eab308'; // gold
      if (s >= 0.3) return '#9ca3af'; // silver
      return '#cd7f32'; // bronze
    };

    // Fetch profile image
    const profileImageData = pfpUrl ? await fetchImageAsDataUrl(pfpUrl) : null;
    
    // Fetch logo with proper error handling
    const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
    console.log('🖼️ Fetching logo from:', logoUrl);
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(logoUrl);
      console.log('✅ Logo fetch result:', logoImageSrc ? 'SUCCESS' : 'FAILED');
      if (logoImageSrc) {
        console.log('🖼️ Logo data URL length:', logoImageSrc.length);
      }
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
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            backgroundImage: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              padding: '60px',
              gap: '60px',
            }}
          >
            {/* Profile Image */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '280px',
                height: '280px',
                borderRadius: '20px',
                backgroundColor: 'rgba(62, 180, 137, 0.1)',
                border: '3px solid rgba(62, 180, 137, 0.3)',
                overflow: 'hidden',
              }}
            >
              {profileImageData ? (
                <img
                  src={profileImageData}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '17px',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#3eb489',
                    fontSize: 120,
                    color: 'white',
                  }}
                >
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* User Info & Scores */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                gap: '25px',
              }}
            >
              {/* Username */}
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                  color: 'white',
                  display: 'flex',
                }}
              >
                @{username}
              </div>

              {/* Scores */}
              <div
                style={{
                  display: 'flex',
                  gap: '20px',
                }}
              >
                {/* Mojo Score */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '16px 28px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span style={{ color: '#9ca3af', fontSize: '18px', marginBottom: '6px', display: 'flex' }}>
                    Mojo
                  </span>
                  <span
                    style={{
                      color: getMojoColor(formattedMojo),
                      fontSize: '44px',
                      fontWeight: 'bold',
                      display: 'flex',
                    }}
                  >
                    {formattedMojo}
                  </span>
                </div>

                {/* Neynar Score */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '16px 28px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span style={{ color: '#9ca3af', fontSize: '18px', marginBottom: '6px', display: 'flex' }}>
                    Neynar
                  </span>
                  <span
                    style={{
                      color: getNeynarColor(formattedNeynar),
                      fontSize: '44px',
                      fontWeight: 'bold',
                      display: 'flex',
                    }}
                  >
                    {formattedNeynar}
                  </span>
                </div>

                {/* Quotient Score */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '16px 28px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span style={{ color: '#9ca3af', fontSize: '18px', marginBottom: '6px', display: 'flex' }}>
                    Quotient
                  </span>
                  <span
                    style={{
                      color: getQuotientColor(formattedQuotient),
                      fontSize: '44px',
                      fontWeight: 'bold',
                      display: 'flex',
                    }}
                  >
                    {formattedQuotient}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Logo in Bottom Right Corner - exact same as collection OG */}
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
      }
    );
  } catch (error) {
    console.error('Error generating profile scores OG image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
