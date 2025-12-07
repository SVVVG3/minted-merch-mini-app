import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            position: 'relative',
          }}
        >
          {/* Background gradient overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(ellipse at center, rgba(62, 180, 137, 0.15) 0%, transparent 70%)',
              display: 'flex',
            }}
          />

          {/* Gift emoji */}
          <div
            style={{
              fontSize: '120px',
              marginBottom: '20px',
              display: 'flex',
            }}
          >
            🎁
          </div>

          {/* Main text */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: '20px',
              display: 'flex',
            }}
          >
            Earn 10,000 $mintedmerch
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '32px',
              color: '#3eb489',
              textAlign: 'center',
              maxWidth: '800px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ display: 'flex' }}>Follow @mintedmerch • Join /mintedmerch</span>
            <span style={{ display: 'flex', marginTop: '10px' }}>Enable Notifications • Claim Reward!</span>
          </div>

          {/* Minted Merch branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                color: 'rgba(255, 255, 255, 0.6)',
                display: 'flex',
              }}
            >
              MINTED MERCH
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
    console.error('OG Follow Error:', error);

    // Fallback
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 80, marginBottom: 20, display: 'flex' }}>🎁</div>
          <div style={{ fontSize: 48, fontWeight: 'bold', display: 'flex' }}>Earn 10,000 $mintedmerch</div>
          <div style={{ fontSize: 32, color: '#3eb489', marginTop: 20, display: 'flex' }}>
            Follow & Claim Your Reward!
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}

