import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pointsEarned = parseInt(searchParams.get('points') || '30');
    const streak = parseInt(searchParams.get('streak') || '1');
    const totalPoints = parseInt(searchParams.get('total') || '100');

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
          {/* Centered Content Container */}
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
            {/* Logo Section */}
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
              <div style={{ fontSize: '120px', color: '#3eb489' }}>🎯</div>
            </div>
            
            {/* Check-in Info Section */}
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
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('OG Error:', error);
    
    // Return fallback image like your working order route
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