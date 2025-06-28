import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle') || 'test';

    // For now, use static data to test ImageResponse
    // We know from debug endpoint that Shopify API works
    const productTitle = "Gdupi Cap";
    const price = "29.97";

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            color: 'white',
            padding: '60px',
          }}
        >
          {/* Product Icon */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: '60px'
          }}>
            <div
              style={{
                width: '400px',
                height: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#2a2a2a',
                borderRadius: '16px',
                fontSize: '120px',
              }}
            >
              🛒
            </div>
          </div>
          
          {/* Product Info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              color: 'white',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                marginBottom: '20px',
                maxWidth: '500px',
                lineHeight: 1.2,
              }}
            >
              {productTitle}
            </div>
            
            <div
              style={{
                fontSize: '36px',
                color: '#3eb489',
                fontWeight: 'bold',
                marginBottom: '20px',
              }}
            >
              ${parseFloat(price).toFixed(2)} USD
            </div>
            
            <div
              style={{
                fontSize: '24px',
                color: '#3eb489',
                marginBottom: '10px',
                fontWeight: '600',
              }}
            >
              Pay with USDC
            </div>
            
            <div
              style={{
                fontSize: '18px',
                color: '#888',
                marginBottom: '20px',
              }}
            >
              Shop crypto merch with instant payments
            </div>
            
            <div
              style={{
                fontSize: '16px',
                color: '#3eb489',
              }}
            >
              Pay on Base 🔵
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    
    // Fallback error image
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
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
          }}
        >
          <div>🛒</div>
          <div style={{ fontSize: '24px', color: '#3eb489', marginTop: '20px' }}>
            Minted Merch Shop
          </div>
          <div style={{ fontSize: '18px', color: '#888', marginTop: '10px' }}>
            Crypto merch with USDC payments
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );
  }
} 