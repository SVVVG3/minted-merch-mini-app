import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pointsEarned = parseInt(searchParams.get('points') || '30');
    const streak = parseInt(searchParams.get('streak') || '1');
    const totalPoints = parseInt(searchParams.get('total') || '100');
    
    // Use simple variables like the order route
    const products = `+${pointsEarned} Points • ${streak} Day Streak`;
    const productImageFailed = false;
    const productImageSrc = null;
    
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Centered Content Container - Larger Scale */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '80px',
              width: '100%',
              height: '100%',
            }}
          >
            {/* Product Image Section - Larger */}
            <div
              style={{
                width: '450px',
                height: '450px',
                borderRadius: '24px',
                backgroundColor: '#2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #3eb489',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {productImageSrc ? (
                <img
                  src={productImageSrc}
                  alt={products}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '20px',
                  }}
                >
                  {productImageFailed ? (
                    <>
                      <div style={{ fontSize: '80px', marginBottom: '20px', color: '#ff6b6b' }}>❌</div>
                      <div style={{ fontSize: '24px', color: '#ff6b6b', marginBottom: '10px' }}>Image Failed</div>
                      <div style={{ fontSize: '16px', color: '#888' }}>
                        {'No URL'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '120px', marginBottom: '20px', color: '#3eb489' }}>🎯</div>
                      <div style={{ fontSize: '32px', color: '#3eb489' }}>Check-in Complete!</div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Order Info Section - Larger */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                maxWidth: '500px',
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  marginBottom: '30px',
                  lineHeight: '1.1',
                  color: '#3eb489',
                }}
              >
                Daily Check-in!
              </div>
              
              <div
                style={{
                  fontSize: '28px',
                  marginBottom: '40px',
                  lineHeight: '1.3',
                  color: 'white',
                }}
              >
                {products}
              </div>
              
              <div
                style={{
                  fontSize: '20px',
                  color: '#3eb489',
                }}
              >
                💎 57 Total Points
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
    
  } catch (error) {
    // Return fallback image
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
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <div style={{ fontSize: 100, color: '#3eb489' }}>🎯</div>
          <div style={{ fontSize: 48, marginTop: 20 }}>Check-in Complete!</div>
          <div style={{ fontSize: 36, color: '#3eb489', marginTop: 20 }}>Minted Merch</div>
          <div style={{ fontSize: 24, color: '#888', marginTop: 20 }}>Error loading details</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 