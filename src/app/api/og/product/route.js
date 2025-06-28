import { ImageResponse } from '@vercel/og';
import React from 'react';

// Use edge runtime for ImageResponse compatibility
export const runtime = 'nodejs';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 40,
          color: 'black',
          background: 'white',
          width: '100%',
          height: '100%',
          padding: '50px 200px',
          textAlign: 'center',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        👋 Hello from Minted Merch
      </div>
    ),
    {
      width: 1200,
      height: 800,
    },
  );
} 