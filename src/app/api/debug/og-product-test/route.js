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
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            backgroundImage: 'linear-gradient(45deg, #000 0%, #1a1a1a 100%)',
            position: 'relative',
          }}
        >
          {/* Background Pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'radial-gradient(circle at 25% 25%, #3eb489 0%, transparent 50%), radial-gradient(circle at 75% 75%, #3eb489 0%, transparent 50%)',
              opacity: 0.1,
            }}
          />
          
          {/* Main Content */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '90%',
              maxWidth: '1100px',
              padding: '60px',
            }}
          >
            {/* Product Icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                alignItems: 'flex-end',
                textAlign: 'right',
                color: 'white',
                marginLeft: '60px',
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
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '16px',
                  color: '#3eb489',
                }}
              >
                <span style={{ marginRight: '8px' }}>Pay on Base</span>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#3eb489',
                    borderRadius: '50%',
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Bottom Right Branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '40px',
              fontSize: '14px',
              color: '#666',
            }}
          >
            mintedmerch.shop
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