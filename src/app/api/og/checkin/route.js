import { ImageResponse } from '@vercel/og';

// Use edge runtime for ImageResponse compatibility
export const runtime = 'nodejs';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    console.log('Fetching image from URL:', imageUrl);
    const response = await fetch(imageUrl);
    console.log('Image fetch response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log('Image fetched successfully, content-type:', contentType, 'size:', buffer.length);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching image from', imageUrl, ':', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pointsEarned = parseInt(searchParams.get('points') || '30');
    const streak = parseInt(searchParams.get('streak') || '1');
    const totalPoints = parseInt(searchParams.get('total') || '100');
    const bustCache = searchParams.get('t'); // Cache busting parameter
    
    console.log('=== OG Check-in Image Generation ===');
    console.log('Raw params:', { pointsEarned, streak, totalPoints, bustCache });
    
    // Fetch logo image with better error handling
    const logoUrl = 'https://mintedmerch.vercel.app/logo.png';
    let logoImageSrc = null;
    try {
      console.log('Fetching logo from:', logoUrl);
      logoImageSrc = await fetchImageAsDataUrl(logoUrl);
      console.log('Logo fetch result:', logoImageSrc ? '✅ Success' : '❌ Failed');
    } catch (error) {
      console.error('❌ Error fetching logo:', error);
    }
    
    console.log('=== FINAL RENDER DECISION ===');
    console.log('Will show logo:', !!logoImageSrc);
    
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
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Centered Content Container - Larger Scale */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '80px',
              width: '100%',
              height: '100%',
            }}
          >
            {/* Check-in Icon Section - Larger */}
            <div
              style={{
                width: '450px',
                height: '450px',
                borderRadius: '24px',
                backgroundColor: '#2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #3eb489',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                <div style={{ fontSize: '120px', marginBottom: '20px', color: '#3eb489' }}>🎯</div>
                <div style={{ fontSize: '32px', color: '#3eb489' }}>Daily Check-in!</div>
              </div>
            </div>
            
            {/* Check-in Info Section - Larger */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                maxWidth: '500px',
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  marginBottom: '30px',
                  lineHeight: '1.1',
                  color: '#3eb489',
                }}
              >
                Check-in Complete!
              </div>
              
              <div
                style={{
                  fontSize: '48px',
                  marginBottom: '20px',
                  lineHeight: '1.3',
                  color: '#f97316',
                  fontWeight: 'bold',
                }}
              >
                +{pointsEarned} Points
              </div>
              
              <div
                style={{
                  fontSize: '28px',
                  marginBottom: '20px',
                  lineHeight: '1.3',
                  color: '#22c55e',
                }}
              >
                💫 {streak} Day Streak
              </div>
              
              <div
                style={{
                  fontSize: '24px',
                  marginBottom: '40px',
                  lineHeight: '1.3',
                  color: '#3b82f6',
                }}
              >
                💎 {totalPoints} Total Points
              </div>
              
              <div
                style={{
                  fontSize: '20px',
                  color: '#3eb489',
                }}
              >
                Minted Merch
              </div>
            </div>
          </div>
          
          {/* Logo in Bottom Right Corner - Doubled Size */}
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
                alt="Minted Merch"
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
      },
    );
    
  } catch (error) {
    console.error('OG Error:', error);
    
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
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>Check-in Complete!</div>
          <div style={{ fontSize: '32px', color: '#3eb489' }}>+{pointsEarned} Points</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 