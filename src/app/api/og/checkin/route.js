import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

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
    
    // Get rarity color based on points
    const getRarityColor = (points) => {
      if (points >= 91) return '#8b5cf6'; // Purple - Epic
      if (points >= 81) return '#3b82f6'; // Blue - Rare  
      if (points >= 66) return '#22c55e'; // Green - Uncommon
      if (points >= 51) return '#eab308'; // Yellow - Uncommon
      if (points >= 36) return '#f97316'; // Orange - Common
      return '#ef4444'; // Red - Common
    };

    const rarityColor = getRarityColor(basePoints);
    
    console.log('Generating ImageResponse...');
    
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
          }}
        >
          <div style={{ fontSize: 60, fontWeight: 'bold', color: '#22c55e', marginBottom: 40 }}>
            Daily Check-in! 🎯
          </div>
          
          <div style={{ fontSize: 120, fontWeight: 'bold', color: rarityColor, marginBottom: 20 }}>
            +{pointsEarned}
          </div>
          
          <div style={{ fontSize: 40, color: 'white', marginBottom: 40 }}>
            Points Earned! 🎉
          </div>
          
          <div style={{ display: 'flex', gap: 60 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#22c55e', padding: 30, borderRadius: 20, color: '#000000' }}>
              <div style={{ fontSize: 40 }}>💫</div>
              <div style={{ fontSize: 30, fontWeight: 'bold' }}>{streak} Day{streak !== 1 ? 's' : ''}</div>
              <div style={{ fontSize: 16 }}>Streak</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#3b82f6', padding: 30, borderRadius: 20, color: 'white' }}>
              <div style={{ fontSize: 40 }}>💎</div>
              <div style={{ fontSize: 30, fontWeight: 'bold' }}>{totalPoints}</div>
              <div style={{ fontSize: 16 }}>Total Points</div>
            </div>
          </div>
          
          <div style={{ fontSize: 20, color: '#a3a3a3', marginTop: 40 }}>
            Keep your streak going! 🌟
          </div>
          
          <div style={{ position: 'absolute', bottom: 30, left: 30, fontSize: 28, fontWeight: 'bold', color: '#22c55e' }}>
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
    
    // Return very simple fallback
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
            fontFamily: 'Arial',
          }}
        >
          <div style={{ fontSize: 100 }}>🎯</div>
          <div style={{ fontSize: 48, marginTop: 20 }}>Daily Check-in!</div>
          <div style={{ fontSize: 36, color: '#22c55e', marginTop: 20 }}>Minted Merch</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 