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
            fontSize: '40px',
            textAlign: 'center',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px', color: '#3eb489' }}>🎯 Check-in Complete!</div>
          <div style={{ fontSize: '36px', marginBottom: '15px', color: '#f97316' }}>+{pointsEarned} Points</div>
          <div style={{ fontSize: '28px', marginBottom: '15px', color: '#22c55e' }}>💫 {streak} Day Streak</div>
          <div style={{ fontSize: '24px', marginBottom: '15px', color: '#3b82f6' }}>💎 {totalPoints} Total Points</div>
          <div style={{ fontSize: '20px', color: '#3eb489' }}>Minted Merch</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('OG Error:', error);
    
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
            fontSize: '32px',
          }}
        >
          Error generating image
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 