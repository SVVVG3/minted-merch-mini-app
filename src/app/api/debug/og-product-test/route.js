import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle') || 'test-product';

    // Use static test data instead of Shopify API
    const productTitle = "Test Product";
    const price = "29.99";

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
            backgroundColor: '#000',
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
            padding: '60px',
          }}
        >
          <div style={{ fontSize: '120px', marginBottom: '40px' }}>🛒</div>
          
          <div style={{ 
            fontSize: '48px', 
            color: 'white',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {productTitle}
          </div>
          
          <div style={{ 
            fontSize: '36px', 
            color: '#3eb489',
            marginBottom: '30px'
          }}>
            ${parseFloat(price).toFixed(2)} USD
          </div>
          
          <div style={{ 
            fontSize: '24px', 
            color: '#3eb489',
            marginBottom: '10px'
          }}>
            Pay with USDC
          </div>
          
          <div style={{ 
            fontSize: '18px', 
            color: '#888'
          }}>
            Shop crypto merch with instant payments
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );
  } catch (error) {
    console.error('Error generating test OG image:', error);
    
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
            Error generating image
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