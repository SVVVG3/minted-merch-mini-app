import { ImageResponse } from 'next/og';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pointsEarned = parseInt(searchParams.get('points') || '30');
  const streak = parseInt(searchParams.get('streak') || '1');
  const totalPoints = parseInt(searchParams.get('total') || '100');

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 40,
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 80, color: '#3eb489' }}>Check-in Complete!</div>
        <div style={{ fontSize: 60, color: '#f97316' }}>+{pointsEarned} Points</div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
} 