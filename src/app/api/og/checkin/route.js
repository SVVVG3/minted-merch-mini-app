import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching image:', error);
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
    
    console.log('Check-in OG params:', { pointsEarned, streak, totalPoints, basePoints, streakBonus });
    
    // Fetch logo
    const logoUrl = 'https://mintedmerch.vercel.app/logo.png';
    const logoImageSrc = await fetchImageAsDataUrl(logoUrl);
    
    // Get streak emoji
    const getStreakEmoji = (streak) => {
      if (streak >= 30) return "👑";
      if (streak >= 14) return "🔥";
      if (streak >= 7) return "⚡";
      if (streak >= 3) return "🌟";
      return "💫";
    };
    
    // Get color based on points
    const getColor = (points) => {
      if (points >= 91) return '#8b5cf6';
      if (points >= 81) return '#3b82f6';
      if (points >= 66) return '#22c55e';
      if (points >= 51) return '#eab308';
      if (points >= 36) return '#f97316';
      return '#ef4444';
    };
    
    const streakEmoji = getStreakEmoji(streak);
    const pointsColor = getColor(basePoints);
    
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#000000',
            color: 'white',
            fontFamily: 'Arial',
            padding: 80,
          }}
        >
          {/* Logo Section - Left */}
          <div
            style={{
              width: '400px',
              height: '400px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#1a1a1a',
              borderRadius: 20,
              marginRight: 80,
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
              <div style={{ fontSize: 80, color: '#3eb489' }}>🎯</div>
            )}
          </div>
          
          {/* Points Info Section - Right */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              flex: 1,
            }}
          >
            {/* Title */}
            <div style={{ 
              fontSize: 48, 
              fontWeight: 'bold', 
              color: '#3eb489',
              marginBottom: 40,
            }}>
              Daily Check-in Complete!
            </div>
            
            {/* Points Earned */}
            <div style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: pointsColor,
              marginBottom: 20,
            }}>
              +{pointsEarned} Points
            </div>
            
            {/* Streak Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 30,
              fontSize: 36,
            }}>
              <span style={{ marginRight: 20 }}>{streakEmoji}</span>
              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>
                {streak} Day Streak
              </span>
            </div>
            
            {/* Total Points */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 40,
              fontSize: 32,
            }}>
              <span style={{ marginRight: 20 }}>💎</span>
              <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>
                {totalPoints} Total Points
              </span>
            </div>
            
            {/* Streak Bonus (if any) */}
            {streakBonus > 0 && (
              <div style={{
                backgroundColor: '#ffc107',
                color: '#000000',
                padding: '15px 25px',
                borderRadius: 12,
                fontSize: 24,
                fontWeight: 'bold',
                marginBottom: 40,
              }}>
                🔥 +{streakBonus} Streak Bonus!
              </div>
            )}
            
            {/* Branding */}
            <div style={{
              fontSize: 28,
              color: '#3eb489',
              fontWeight: 'bold',
            }}>
              Minted Merch
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
    console.error('OG Check-in Error:', error);
    
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
} 