import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pointsEarned = parseInt(searchParams.get('points') || '30');
    const streak = parseInt(searchParams.get('streak') || '1');
    const totalPoints = parseInt(searchParams.get('total') || '100');
    const basePoints = parseInt(searchParams.get('base') || '30');
    const streakBonus = parseInt(searchParams.get('bonus') || '0');
    const bustCache = searchParams.get('t');
    
    console.log('=== OG Check-in Image Generation ===');
    console.log('Params:', { pointsEarned, streak, totalPoints, basePoints, streakBonus, bustCache });
    
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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
            color: 'white',
            fontFamily: 'Arial',
            padding: '40px',
          }}
        >
          {/* Header */}
          <div style={{ 
            fontSize: 50, 
            fontWeight: 'bold', 
            color: '#22c55e', 
            marginBottom: 40,
            textAlign: 'center',
          }}>
            Daily Check-in Complete! 🎯
          </div>
          
          {/* Main Points Display */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: '#1a1a1a',
            padding: 50,
            borderRadius: 20,
            border: `4px solid ${rarityColor}`,
            marginBottom: 40,
          }}>
            <div style={{ 
              fontSize: 100, 
              fontWeight: 'bold', 
              color: rarityColor,
              marginBottom: 10,
            }}>
              +{pointsEarned}
            </div>
            
            <div style={{ 
              fontSize: 32, 
              fontWeight: 'bold', 
              color: '#ffffff',
            }}>
              Points Earned! 🎉
            </div>
            
            {/* Points Breakdown */}
            {streakBonus > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#ffc107',
                padding: '15px 30px',
                borderRadius: 12,
                color: '#000000',
                marginTop: 20,
                fontSize: 20,
                fontWeight: 'bold',
              }}>
                🎯 Base: {basePoints} + 🔥 Streak Bonus: {streakBonus}
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div style={{
            display: 'flex',
            gap: 40,
            alignItems: 'center',
            marginBottom: 30,
          }}>
            {/* Streak */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#22c55e',
              padding: 25,
              borderRadius: 16,
              color: '#000000',
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{streakEmoji}</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 4 }}>
                {streak} Day{streak !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 14 }}>Streak</div>
            </div>

            {/* Total Points */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#3b82f6',
              padding: 25,
              borderRadius: 16,
              color: '#ffffff',
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💎</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 4 }}>
                {totalPoints}
              </div>
              <div style={{ fontSize: 14 }}>Total Points</div>
            </div>
          </div>

          {/* Call to Action */}
          <div style={{
            fontSize: 20,
            color: '#a3a3a3',
            textAlign: 'center',
            marginBottom: 20,
          }}>
            Keep your streak going! Return tomorrow for more rewards 🌟
          </div>

          {/* Minted Merch Branding */}
          <div style={{
            position: 'absolute',
            bottom: 25,
            left: 25,
            fontSize: 24,
            fontWeight: 'bold',
            color: '#22c55e',
          }}>
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
    console.error('❌ OG Check-in Error:', error);
    console.error('Error stack:', error.stack);
    
    // Return text response if ImageResponse fails
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
} 