import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f0fdf4',
            backgroundImage: 'linear-gradient(45deg, #3eb489 0%, #22c55e 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '60px',
              margin: '40px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div
              style={{
                fontSize: '72px',
                marginBottom: '20px',
              }}
            >
              🎫
            </div>
            
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#1f2937',
                textAlign: 'center',
                marginBottom: '16px',
              }}
            >
              $MINTEDMERCH
            </div>
            
            <div
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#3eb489',
                textAlign: 'center',
                marginBottom: '24px',
              }}
            >
              Holders Chat
            </div>
            
            <div
              style={{
                fontSize: '24px',
                color: '#6b7280',
                textAlign: 'center',
                marginBottom: '32px',
              }}
            >
              Exclusive community for 50M+ token holders
            </div>
            
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#3eb489',
                color: 'white',
                padding: '16px 32px',
                borderRadius: '12px',
                fontSize: '20px',
                fontWeight: 'bold',
              }}
            >
              Check Your Eligibility
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
