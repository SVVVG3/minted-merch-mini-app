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
          fontSize: 128,
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        Static Check-in Test!
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
} 