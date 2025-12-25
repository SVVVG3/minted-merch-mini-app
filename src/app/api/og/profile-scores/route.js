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
    // Mojo score param exists but we won't display it for now
    // const mojoScore = searchParams.get('mojo');
    
    // Format scores to 2 decimal places
    const formattedNeynar = parseFloat(neynarScore).toFixed(2);
    const formattedQuotient = parseFloat(quotientScore).toFixed(2);
    
    // Color coding for scores
    const getNeynarColor = (score) => {
      const s = parseFloat(score);
      if (s >= 0.9) return '#22c55e'; // green
      if (s >= 0.7) return '#eab308'; // yellow
      return '#ef4444'; // red
    };
    
    const getQuotientColor = (score) => {
      const s = parseFloat(score);
      if (s >= 0.9) return '#a855f7'; // purple
      if (s >= 0.8) return '#3b82f6'; // blue
      if (s >= 0.7) return '#22c55e'; // green
      if (s >= 0.6) return '#eab308'; // yellow
      return '#ef4444'; // red
    };

    // Fetch profile image
    const profileImageData = pfpUrl ? await fetchImageAsDataUrl(pfpUrl) : null;
    
    // Fetch logo
    const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
    const logoImageSrc = await fetchImageAsDataUrl(logoUrl);

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
              padding: '40px',
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
                  gap: '30px',
                }}
              >
                {/* Neynar Score */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '20px 35px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span style={{ color: '#9ca3af', fontSize: '20px', marginBottom: '8px', display: 'flex' }}>
                    Neynar Score
                  </span>
                  <span
                    style={{
                      color: getNeynarColor(formattedNeynar),
                      fontSize: '52px',
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
                    padding: '20px 35px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span style={{ color: '#9ca3af', fontSize: '20px', marginBottom: '8px', display: 'flex' }}>
                    Quotient Score
                  </span>
                  <span
                    style={{
                      color: getQuotientColor(formattedQuotient),
                      fontSize: '52px',
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
          
          {/* Logo in Bottom Right Corner */}
          {logoImageSrc && (
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '30px',
                width: '100px',
                height: '100px',
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
                  width: '75px',
                  height: '75px',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating profile scores OG image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
