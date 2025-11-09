import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const points = searchParams.get('points') || '50';
    const streak = searchParams.get('streak') || '1';
    const totalPoints = searchParams.get('total') || '50';
    const multiplier = parseFloat(searchParams.get('multiplier') || '1');
    const tier = searchParams.get('tier') || 'none';
    
    console.log('🎯 Check-in OG params:', { points, streak, totalPoints, multiplier, tier });
    
    // Check if user is a Merch Mogul (50M+ tokens) based on multiplier
    const isMerchMogul = multiplier >= 2; // 2x+ multiplier means 50M+ tokens
    
    // Fetch logo image
    const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(logoUrl);
    } catch (error) {
      console.error('Error fetching logo:', error);
    }
    
    // Fetch Merch Mogul badge if applicable
    let merchMogulBadgeData = null;
    if (isMerchMogul) {
      const badgeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/MerchMogulBadge.png`;
      console.log('🏆 Fetching Merch Mogul badge from:', badgeUrl);
      try {
        merchMogulBadgeData = await fetchImageAsDataUrl(badgeUrl);
        console.log('✅ Merch Mogul badge fetch result:', merchMogulBadgeData ? 'SUCCESS' : 'FAILED');
      } catch (error) {
        console.error('❌ Error fetching Merch Mogul badge:', error);
      }
    }
    
    // Create static strings for JSX to avoid interpolation issues
    const pointsText = `Earned ${points} points!`; // Removed 🎉 emoji
    const streakText = `${streak} day streak 🔥`;
    const totalText = `💎 ${parseInt(totalPoints).toLocaleString()} Total Points`;
    const multiplierText = multiplier > 1 ? `${multiplier}x ${tier === 'legendary' ? '🏆' : '⭐'}` : null;
    
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
            backgroundImage: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
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
            {/* Logo Section - Larger */}
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
              {logoImageSrc ? (
                <img
                  src={logoImageSrc}
                  alt="Minted Merch"
                  style={{
                    width: '300px',
                    height: '300px',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div style={{ fontSize: '120px', color: '#3eb489' }}>🎯</div>
              )}
            </div>
            
            {/* Check-in Info Section - Larger */}
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
                  fontSize: '72px',
                  fontWeight: 'bold',
                  marginBottom: '30px',
                  lineHeight: '1.1',
                  color: '#3eb489',
                }}
              >
                Daily Check-in
              </div>
              
              <div
                style={{
                  fontSize: '42px', // Made smaller (was 54px)
                  color: 'white',
                  marginBottom: '25px',
                  lineHeight: '1.3',
                }}
              >
                {pointsText}
              </div>
              
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    fontSize: '42px', // Increased by 50% from 28px
                    color: '#3eb489',
                  }}
                >
                  {streakText}
                </div>
                {/* Merch Mogul badge next to streak */}
                {merchMogulBadgeData && (
                  <img
                    src={merchMogulBadgeData}
                    alt="Merch Mogul"
                    style={{
                      width: '180px', // Increased by 50% from 120px
                      height: '45px', // Increased by 50% from 30px
                      objectFit: 'contain',
                    }}
                  />
                )}
              </div>
              
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                }}
              >
                <div
                  style={{
                    fontSize: '36px', // Increased by 50% from 24px
                    color: '#888',
                  }}
                >
                  {totalText}
                </div>
                {/* Multiplier badge */}
                {multiplierText && (
                  <div
                    style={{
                      fontSize: '27px', // Increased by 50% from 18px
                      color: multiplier === 5 ? '#8b5cf6' : '#3b82f6',
                      backgroundColor: multiplier === 5 ? '#f3e8ff' : '#dbeafe',
                      padding: '12px 18px', // Increased padding proportionally
                      borderRadius: '30px', // Increased border radius proportionally
                      fontWeight: 'bold',
                    }}
                  >
                    {multiplierText}
                  </div>
                )}
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
    console.error('OG Error:', error);
    
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
          <div style={{ fontSize: 48, marginTop: 20, color: '#3eb489' }}>Daily Check-in</div>
          <div style={{ fontSize: 32, color: 'white', marginTop: 20 }}>Minted Merch Rewards</div>
          <div style={{ fontSize: 24, color: '#888', marginTop: 20 }}>Keep your streak going!</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 