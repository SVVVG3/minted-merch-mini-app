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
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'Arial',
          padding: 60,
        }}
      >
        <div
          style={{
            width: 400,
            height: 400,
            backgroundColor: '#1a1a1a',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 60,
          }}
        >
          🎯
        </div>
        <div
          style={{
            fontSize: 40,
            textAlign: 'left',
            lineHeight: 1.4,
            flex: 1,
          }}
        >
          Daily Check-in Complete!
          
          +{pointsEarned} Points Earned
          
          💫 {streak} Day Streak  💎 {totalPoints} Total Points
          
          Minted Merch
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
} 