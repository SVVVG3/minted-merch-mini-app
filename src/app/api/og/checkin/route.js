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
            {/* Logo Section - Left */}
            <div
              style={{
                width: '400px',
                height: '400px',
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
              <div style={{ fontSize: '80px', color: '#3eb489' }}>🎯</div>
            </div>
            
            {/* Points Info Section - Right */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                flex: 1,
              }}
            >
              <div style={{ 
                fontSize: '48px', 
                fontWeight: 'bold', 
                color: '#3eb489',
                marginBottom: '40px',
              }}>
                Daily Check-in Complete!
              </div>
              
              <div style={{
                fontSize: '80px',
                fontWeight: 'bold',
                color: '#f97316',
                marginBottom: '20px',
              }}>
                +{pointsEarned} Points
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '30px',
                fontSize: '36px',
              }}>
                <span style={{ marginRight: '20px' }}>💫</span>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>
                  {streak} Day Streak
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '40px',
                fontSize: '32px',
              }}>
                <span style={{ marginRight: '20px' }}>💎</span>
                <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>
                  {totalPoints} Total Points
                </span>
              </div>
              
              <div style={{
                fontSize: '28px',
                color: '#3eb489',
                fontWeight: 'bold',
              }}>
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
    console.error('OG Check-in Error:', error);
    
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
} 