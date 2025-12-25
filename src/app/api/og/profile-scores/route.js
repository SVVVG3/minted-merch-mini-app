import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const username = searchParams.get('username') || 'User';
    const pfpUrl = searchParams.get('pfpUrl');
    const neynarScore = searchParams.get('neynar') || '0.00';
    const quotientScore = searchParams.get('quotient') || '0.00';
    const mojoScore = searchParams.get('mojo'); // Optional for now
    
    // Format scores to 2 decimal places
    const formattedNeynar = parseFloat(neynarScore).toFixed(2);
    const formattedQuotient = parseFloat(quotientScore).toFixed(2);
    const formattedMojo = mojoScore ? parseFloat(mojoScore).toFixed(2) : null;
    
    // Color coding for scores
    const getNeynarColor = (score) => {
      const s = parseFloat(score);
      if (s >= 0.9) return '#22c55e'; // green
      if (s >= 0.7) return '#eab308'; // yellow
      return '#ef4444'; // red
    };
    
    const getQuotientColor = (score) => {
      const s = parseFloat(score);
      if (s >= 0.9) return '#a855f7'; // purple
      if (s >= 0.8) return '#3b82f6'; // blue
      if (s >= 0.7) return '#22c55e'; // green
      if (s >= 0.6) return '#eab308'; // yellow
      return '#ef4444'; // red
    };
    
    const getMojoColor = (score) => {
      const s = parseFloat(score);
      if (s >= 0.8) return '#f59e0b'; // amber/gold
      if (s >= 0.6) return '#22c55e'; // green
      if (s >= 0.4) return '#3b82f6'; // blue
      return '#6b7280'; // gray
    };

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '40px',
            }}
          >
            <img
              src="https://app.mintedmerch.shop/MintedMerchHeaderLogo.png"
              width="60"
              height="60"
              style={{ marginRight: '16px' }}
            />
            <span style={{ color: '#22c55e', fontSize: '36px', fontWeight: 'bold' }}>
              Minted Merch Scores
            </span>
          </div>

          {/* Profile Section */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '50px',
            }}
          >
            {pfpUrl ? (
              <img
                src={pfpUrl}
                width="120"
                height="120"
                style={{
                  borderRadius: '60px',
                  border: '4px solid #22c55e',
                  marginRight: '24px',
                }}
              />
            ) : (
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '60px',
                  background: '#374151',
                  border: '4px solid #22c55e',
                  marginRight: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  fontSize: '48px',
                }}
              >
                ?
              </div>
            )}
            <span style={{ color: 'white', fontSize: '48px', fontWeight: 'bold' }}>
              @{username}
            </span>
          </div>

          {/* Scores Grid */}
          <div
            style={{
              display: 'flex',
              gap: '40px',
            }}
          >
            {/* Neynar Score */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '30px 50px',
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: '24px', marginBottom: '10px' }}>
                Neynar Score
              </span>
              <span
                style={{
                  color: getNeynarColor(formattedNeynar),
                  fontSize: '64px',
                  fontWeight: 'bold',
                }}
              >
                {formattedNeynar}
              </span>
            </div>

            {/* Quotient Score */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '30px 50px',
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: '24px', marginBottom: '10px' }}>
                Quotient Score
              </span>
              <span
                style={{
                  color: getQuotientColor(formattedQuotient),
                  fontSize: '64px',
                  fontWeight: 'bold',
                }}
              >
                {formattedQuotient}
              </span>
            </div>

            {/* Mojo Score (if provided) */}
            {formattedMojo && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '20px',
                  padding: '30px 50px',
                }}
              >
                <span style={{ color: '#9ca3af', fontSize: '24px', marginBottom: '10px' }}>
                  Mojo Score
                </span>
                <span
                  style={{
                    color: getMojoColor(formattedMojo),
                    fontSize: '64px',
                    fontWeight: 'bold',
                  }}
                >
                  {formattedMojo}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              display: 'flex',
              alignItems: 'center',
              color: '#6b7280',
              fontSize: '20px',
            }}
          >
            app.mintedmerch.shop
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating profile scores OG image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}

