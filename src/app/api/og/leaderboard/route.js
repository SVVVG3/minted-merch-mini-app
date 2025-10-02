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
    const pfpUrl = searchParams.get('pfp');
    const multiplier = searchParams.get('multiplier') || '1';
    const tier = searchParams.get('tier') || 'none';
    const category = searchParams.get('category') || 'points';

    console.log('🏆 Generating leaderboard OG image with params:', {
      position,
      points,
      username,
      pfpUrl,
      multiplier,
      tier,
      category
    });

    // Fetch user profile image if available
    let userImageDataUrl = null;
    if (pfpUrl) {
      userImageDataUrl = await fetchImageAsDataUrl(pfpUrl);
    }

    // Format points with commas
    const formattedPoints = parseInt(points).toLocaleString();
    
    // Get multiplier display info
    const multiplierDisplay = multiplier > 1 ? `${multiplier}x` : '';
    const multiplierEmoji = tier === 'legendary' ? '🏆' : tier === 'elite' ? '⭐' : '';
    
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
          {/* Main Content Container */}
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
            {/* User Avatar */}
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
              {userImageDataUrl ? (
                <img
                  src={userImageDataUrl}
                  alt={username}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3eb489',
                  }}
                >
                  <div style={{ fontSize: 120, marginBottom: 20 }}>👤</div>
                  <div style={{ fontSize: 32, textAlign: 'center' }}>User</div>
                </div>
              )}
            </div>

            {/* Text Content */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                maxWidth: '600px',
              }}
            >
              <div
                style={{
                  fontSize: '72px',
                  fontWeight: 'bold',
                  color: '#3eb489',
                  marginBottom: '20px',
                  lineHeight: 1,
                }}
              >
                #{positionText}
              </div>
              
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: 'white',
                  marginBottom: '20px',
                  lineHeight: 1.2,
                }}
              >
                {username}
              </div>
              
              <div
                style={{
                  fontSize: '32px',
                  color: '#cccccc',
                  marginBottom: '20px',
                  lineHeight: 1.2,
                }}
              >
                {formattedPoints} points in {categoryName}
              </div>
              
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  color: tier === 'legendary' ? '#7c3aed' : '#2563eb',
                  backgroundColor: tier === 'legendary' ? '#f3e8ff' : '#dbeafe',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  display: multiplierDisplay ? 'block' : 'none',
                }}
              >
                {multiplierDisplay} {multiplierEmoji}
              </div>
            </div>
          </div>
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
