import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('=== Basic OG Test ===');
    
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
            color: 'white',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 60,
          }}
        >
          Hello World! 🎯
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('❌ Basic OG Error:', error);
    console.error('Error stack:', error.stack);
    
    // Return text response if ImageResponse fails
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
} 