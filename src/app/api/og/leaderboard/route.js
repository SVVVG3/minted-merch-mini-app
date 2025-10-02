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
            backgroundColor: '#3eb489',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            padding: '60px',
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 'bold', marginBottom: '20px' }}>
            🏆 #{positionText}
          </div>
          <div style={{ fontSize: 48, fontWeight: 'bold', marginBottom: '20px' }}>
            {username}
          </div>
          <div style={{ fontSize: 32, marginBottom: '20px', opacity: 0.9 }}>
            {formattedPoints} points in {categoryName}
          </div>
          {multiplierDisplay && (
            <div style={{ fontSize: 24, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px 24px', borderRadius: '12px' }}>
              {multiplierDisplay} {multiplierEmoji}
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
