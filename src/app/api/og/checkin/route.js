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
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 20, color: '#3eb489' }}>🎯</div>
        <div style={{ fontSize: 60, marginBottom: 30, color: '#3eb489' }}>Daily Check-in Complete!</div>
        <div style={{ fontSize: 80, marginBottom: 20, color: '#f97316' }}>+{pointsEarned} Points</div>
        <div style={{ fontSize: 40, marginBottom: 20, color: '#22c55e' }}>💫 {streak} Day Streak</div>
        <div style={{ fontSize: 35, marginBottom: 30, color: '#3b82f6' }}>💎 {totalPoints} Total Points</div>
        <div style={{ fontSize: 30, color: '#3eb489' }}>Minted Merch</div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
} 