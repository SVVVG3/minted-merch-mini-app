import { ImageResponse } from 'next/og';

export const runtime = 'edge';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    console.log(`🖼️ Fetching image from: ${imageUrl}`);
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OG-Image-Generator/1.0)',
      },
    });
    
    console.log(`📊 Image fetch status: ${response.status}`);
    console.log(`📊 Image fetch headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch image: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log(`📊 Image size: ${arrayBuffer.byteLength} bytes, type: ${contentType}`);
    
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;
    
    console.log(`✅ Successfully converted image to data URL (${base64.length} chars)`);
    return dataUrl;
  } catch (error) {
    console.error('❌ Error fetching image:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position') || '?';
    const points = searchParams.get('points') || '0';
    const username = searchParams.get('username') || 'Anonymous';
    const multiplier = searchParams.get('multiplier') || '1';
    const tier = searchParams.get('tier') || 'none';
    const category = searchParams.get('category') || 'points';
    const profileImage = searchParams.get('profileImage') || null;

    // Format points with commas
    const formattedPoints = parseInt(points).toLocaleString();
    
    // Get position suffix
    const getPositionSuffix = (pos) => {
      const num = parseInt(pos);
      if (isNaN(num)) return pos;
      const lastDigit = num % 10;
      const lastTwoDigits = num % 100;
      
      if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${num}th`;
      if (lastDigit === 1) return `${num}st`;
      if (lastDigit === 2) return `${num}nd`;
      if (lastDigit === 3) return `${num}rd`;
      return `${num}th`;
    };

    const positionText = getPositionSuffix(position);
    
    // Get category display name
    const categoryNames = {
      'points': 'Points',
      'streaks': 'Streaks', 
      'purchases': 'Purchases',
      'holders': '$MINTEDMERCH Holders'
    };
    const categoryName = categoryNames[category] || 'Points';
    
    // Get multiplier info
    const multiplierDisplay = multiplier > 1 ? `${multiplier}x` : '';
    const multiplierEmoji = tier === 'legendary' ? '🏆' : tier === 'elite' ? '⭐' : '';

    // Fetch profile image and logo
    const profileImageData = profileImage ? await fetchImageAsDataUrl(profileImage) : null;
    const logoImageData = await fetchImageAsDataUrl('https://mintedmerch.vercel.app/MintedMerchHeaderLogo.png');

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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '400px',
                height: '400px',
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

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                maxWidth: '500px',
                gap: '20px',
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 'bold',
                  color: '#3eb489',
                  lineHeight: 1.1,
                  textAlign: 'left',
                  display: 'flex',
                }}
              >
                {username}
              </div>

              <div
                style={{
                  fontSize: 40,
                  color: '#3eb489',
                  textAlign: 'left',
                  display: 'flex',
                  fontWeight: 'bold',
                }}
              >
                #{positionText}
              </div>

              <div
                style={{
                  fontSize: 28,
                  color: '#cccccc',
                  lineHeight: 1.3,
                  textAlign: 'left',
                  display: 'flex',
                }}
              >
                {formattedPoints} points in {categoryName}
              </div>

              <div
                style={{
                  fontSize: 32,
                  color: '#888888',
                  textAlign: 'left',
                  display: 'flex',
                }}
              >
                Leaderboard Position
              </div>

              <div
                style={{
                  fontSize: 24,
                  color: '#3eb489',
                  textAlign: 'left',
                  marginTop: '20px',
                  display: 'flex',
                }}
              >
                {multiplierDisplay ? `${multiplierDisplay} ${multiplierEmoji} Multiplier` : ''}
              </div>
            </div>
          </div>
          
          {/* Logo in bottom right corner */}
          {logoImageData && (
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                right: '30px',
                display: 'flex',
              }}
            >
              <img
                src={logoImageData}
                style={{
                  width: '120px',
                  height: 'auto',
                  opacity: 0.8,
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
    console.error('Error generating leaderboard OG image:', error);
    
    // Fallback image
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#3eb489',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: '72px',
              marginBottom: '20px',
              display: 'flex',
            }}
          >
            🏆
          </div>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              textAlign: 'center',
              display: 'flex',
            }}
          >
            Minted Merch Leaderboard
          </div>
          <div
            style={{
              fontSize: '24px',
              color: 'rgba(255, 255, 255, 0.8)',
              textAlign: 'center',
              marginTop: '20px',
              display: 'flex',
            }}
          >
            Shop & pay with USDC on Base 🟦
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
