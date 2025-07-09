import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    console.log('=== OG Check-in Image Generation ===');
    console.log('Request URL:', request.url);
    
    const { searchParams } = new URL(request.url);
    const pointsEarned = parseInt(searchParams.get('points') || '30');
    const streak = parseInt(searchParams.get('streak') || '1');
    const totalPoints = parseInt(searchParams.get('total') || '100');
    
    console.log('Parsed params:', { pointsEarned, streak, totalPoints });
    
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
            fontSize: '40px',
            textAlign: 'center',
            flexDirection: 'column',
          }}
        >
          <div style={{ marginBottom: '20px', color: '#3eb489' }}>🎯 Daily Check-in Complete! 🎯</div>
          <div style={{ marginBottom: '20px' }}>+{pointsEarned} Points Earned</div>
          <div style={{ marginBottom: '20px' }}>💫 {streak} Day Streak</div>
          <div style={{ marginBottom: '20px' }}>💎 {totalPoints} Total Points</div>
          <div style={{ fontSize: '24px', color: '#3eb489' }}>Minted Merch</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('❌ OG Check-in Error:', error);
    console.error('Error stack:', error.stack);
    
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ff0000',
            color: 'white',
            fontSize: '32px',
          }}
        >
          Error: {error.message}
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 