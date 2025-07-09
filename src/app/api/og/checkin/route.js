import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pointsEarned = parseInt(searchParams.get('points') || '30');
    const streak = parseInt(searchParams.get('streak') || '1');
    const totalPoints = parseInt(searchParams.get('total') || '100');
    
    console.log('Check-in OG params:', { pointsEarned, streak, totalPoints });
    
    // Color based on points earned (rarity system)
    let pointsColor = '#ef4444'; // red (25-35)
    if (pointsEarned >= 91) pointsColor = '#8b5cf6'; // purple (91-100)
    else if (pointsEarned >= 81) pointsColor = '#3b82f6'; // blue (81-90)
    else if (pointsEarned >= 66) pointsColor = '#22c55e'; // green (66-80)
    else if (pointsEarned >= 51) pointsColor = '#eab308'; // yellow (51-65)
    else if (pointsEarned >= 36) pointsColor = '#f97316'; // orange (36-50)
    
    // Streak emoji based on achievement
    let streakEmoji = '💫'; // 1-2 days
    if (streak >= 30) streakEmoji = '👑'; // 30+ days
    else if (streak >= 14) streakEmoji = '🔥'; // 14+ days  
    else if (streak >= 7) streakEmoji = '⚡'; // 7+ days
    else if (streak >= 3) streakEmoji = '🌟'; // 3+ days
    
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
              width: 400,
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#1a1a1a',
              borderRadius: 20,
              marginRight: 80,
            }}
          >
            <div style={{ fontSize: 80, color: '#3eb489' }}>🎯</div>
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
            <div style={{ 
              fontSize: 48, 
              fontWeight: 'bold', 
              color: '#3eb489',
              marginBottom: 40,
            }}>
              Daily Check-in Complete!
            </div>
            
            <div style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: pointsColor,
              marginBottom: 20,
            }}>
              +{pointsEarned} Points
            </div>
            
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