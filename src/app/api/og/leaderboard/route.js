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
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: 'white',
                textAlign: 'center',
              }}
            >
              🏆 Minted Merch Leaderboard
            </div>
          </div>

          {/* Main Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '60px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxWidth: '800px',
              width: '90%',
            }}
          >
            {/* User Avatar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '30px',
              }}
            >
              {userImageDataUrl ? (
                <img
                  src={userImageDataUrl}
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '60px',
                    border: '6px solid #3eb489',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '60px',
                    backgroundColor: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '48px',
                    color: '#6b7280',
                    border: '6px solid #3eb489',
                  }}
                >
                  👤
                </div>
              )}
            </div>

            {/* Username */}
            <div
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              {username}
            </div>

            {/* Position */}
            <div
              style={{
                fontSize: '72px',
                fontWeight: 'bold',
                color: '#3eb489',
                marginBottom: '10px',
                textAlign: 'center',
              }}
            >
              #{positionText}
            </div>

            {/* Category */}
            <div
              style={{
                fontSize: '24px',
                color: '#6b7280',
                marginBottom: '30px',
                textAlign: 'center',
              }}
            >
              in {categoryName}
            </div>

            {/* Points */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                }}
              >
                {formattedPoints}
              </div>
              <div
                style={{
                  fontSize: '24px',
                  color: '#6b7280',
                }}
              >
                points
              </div>
            </div>

            {/* Multiplier Badge */}
            <div
              style={{
                display: multiplierDisplay ? 'flex' : 'none',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: tier === 'legendary' ? '#f3e8ff' : '#dbeafe',
                color: tier === 'legendary' ? '#7c3aed' : '#2563eb',
                padding: '12px 24px',
                borderRadius: '20px',
                fontSize: '20px',
                fontWeight: '600',
              }}
            >
              {multiplierDisplay} {multiplierEmoji}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: '40px',
              fontSize: '20px',
              color: 'rgba(255, 255, 255, 0.8)',
              textAlign: 'center',
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
