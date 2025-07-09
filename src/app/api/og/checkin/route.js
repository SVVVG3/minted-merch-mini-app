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
          fontSize: 50,
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'Arial',
          lineHeight: 1.5,
        }}
      >
        🎯 Daily Check-in Complete! 🎯
        
        +{pointsEarned} Points Earned
        
        💫 {streak} Day Streak
        
        💎 {totalPoints} Total Points
        
        Minted Merch
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
} 