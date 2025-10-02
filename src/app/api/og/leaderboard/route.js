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
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#3eb489',
            color: 'white',
            fontSize: 48,
            fontWeight: 'bold',
          }}
        >
          🏆 Leaderboard Test
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
