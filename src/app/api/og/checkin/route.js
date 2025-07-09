import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    console.log('Fetching image from URL:', imageUrl);
    const response = await fetch(imageUrl);
    console.log('Image fetch response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log('Image fetched successfully, content-type:', contentType, 'size:', buffer.length);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching image from', imageUrl, ':', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pointsEarned = parseInt(searchParams.get('points') || '30');
    const streak = parseInt(searchParams.get('streak') || '1');
    const totalPoints = parseInt(searchParams.get('total') || '100');
    const basePoints = parseInt(searchParams.get('base') || '30');
    const streakBonus = parseInt(searchParams.get('bonus') || '0');
    const bustCache = searchParams.get('t'); // Cache busting parameter
    
    console.log('=== OG Check-in Image Generation ===');
    console.log('Params:', { pointsEarned, streak, totalPoints, basePoints, streakBonus, bustCache });
    
    // Fetch logo image
    const logoUrl = 'https://mintedmerch.vercel.app/logo.png';
    let logoImageSrc = null;
    try {
      console.log('Fetching logo from:', logoUrl);
      logoImageSrc = await fetchImageAsDataUrl(logoUrl);
      console.log('Logo fetch result:', logoImageSrc ? '✅ Success' : '❌ Failed');
    } catch (error) {
      console.error('❌ Error fetching logo:', error);
    }

    // Get streak emoji based on streak count
    const getStreakEmoji = (streak) => {
      if (streak >= 30) return "👑";
      if (streak >= 14) return "🔥";
      if (streak >= 7) return "⚡";
      if (streak >= 3) return "🌟";
      return "💫";
    };

    // Get rarity color based on points
    const getRarityColor = (points) => {
      if (points >= 91) return '#8b5cf6'; // Purple - Epic
      if (points >= 81) return '#3b82f6'; // Blue - Rare  
      if (points >= 66) return '#22c55e'; // Green - Uncommon
      if (points >= 51) return '#eab308'; // Yellow - Uncommon
      if (points >= 36) return '#f97316'; // Orange - Common
      return '#ef4444'; // Red - Common
    };

    const streakEmoji = getStreakEmoji(streak);
    const rarityColor = getRarityColor(basePoints);
    
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
          {/* Background Gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(135deg, ${rarityColor}20, #1a1a1a)`,
            }}
          />

          {/* Main Content Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '40px',
              width: '100%',
              height: '100%',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(45deg, #3eb489, #22c55e)',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Daily Check-in Complete! 🎯
              </div>
            </div>

            {/* Main Points Display */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '30px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                padding: '60px',
                borderRadius: '24px',
                border: `3px solid ${rarityColor}`,
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* Main Points */}
              <div
                style={{
                  fontSize: '120px',
                  fontWeight: 'black',
                  color: rarityColor,
                  textShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  lineHeight: 1,
                }}
              >
                +{pointsEarned}
              </div>
              
              {/* Points Label */}
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  marginTop: '-20px',
                }}
              >
                Points Earned! 🎉
              </div>

              {/* Points Breakdown */}
              {streakBonus > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    backgroundColor: 'rgba(255, 193, 7, 0.2)',
                    padding: '20px 40px',
                    borderRadius: '16px',
                    border: '2px solid #ffc107',
                  }}
                >
                  <div style={{ fontSize: '24px', color: '#ffc107', fontWeight: 'bold' }}>
                    🎯 Base: {basePoints} + 🔥 Streak Bonus: {streakBonus}
                  </div>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div
              style={{
                display: 'flex',
                gap: '60px',
                alignItems: 'center',
              }}
            >
              {/* Streak */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  padding: '30px',
                  borderRadius: '20px',
                  border: '2px solid #22c55e',
                }}
              >
                <div style={{ fontSize: '48px' }}>{streakEmoji}</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#22c55e' }}>
                  {streak} Day{streak !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '18px', color: '#a3a3a3' }}>
                  Streak
                </div>
              </div>

              {/* Total Points */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  padding: '30px',
                  borderRadius: '20px',
                  border: '2px solid #3b82f6',
                }}
              >
                <div style={{ fontSize: '48px' }}>💎</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#3b82f6' }}>
                  {totalPoints}
                </div>
                <div style={{ fontSize: '18px', color: '#a3a3a3' }}>
                  Total Points
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div
              style={{
                fontSize: '24px',
                color: '#a3a3a3',
                textAlign: 'center',
              }}
            >
              Keep your streak going! Return tomorrow for more rewards 🌟
            </div>
          </div>

          {/* Logo */}
          {logoImageSrc && (
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                right: '30px',
                width: '160px',
                height: '160px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <img
                src={logoImageSrc}
                alt="Minted Merch"
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}

          {/* Minted Merch Branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              left: '30px',
              fontSize: '28px',
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #3eb489, #22c55e)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Minted Merch
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('OG Check-in Error:', error);
    
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
          <div style={{ fontSize: 48, marginTop: 20 }}>Daily Check-in!</div>
          <div style={{ fontSize: 36, color: '#3eb489', marginTop: 20 }}>Minted Merch</div>
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