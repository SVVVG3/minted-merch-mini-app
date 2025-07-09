import { ImageResponse } from 'next/og';

export async function GET() {
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
        Hello World!
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
} 