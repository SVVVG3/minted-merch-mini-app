import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
      throw new Error('Product handle is required');
    }

    // Fetch product data
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mintedmerch.vercel.app';
    const response = await fetch(`${baseUrl}/api/shopify/products?handle=${handle}`);
    
    if (!response.ok) {
      throw new Error('Product not found');
    }

    const product = await response.json();
    const mainImage = product.images?.edges?.[0]?.node;
    const price = product.priceRange?.minVariantPrice?.amount || '0';

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
              backgroundImage: `radial-gradient(circle at 25px 25px, #3eb489 2px, transparent 0), radial-gradient(circle at 75px 75px, #3eb489 2px, transparent 0)`,
              backgroundSize: '100px 100px',
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
              maxWidth: '1000px',
              padding: '40px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '20px',
              border: '1px solid rgba(62, 180, 137, 0.3)',
            }}
          >
            {/* Product Image */}
            {mainImage?.url && (
              <div
                style={{
                  width: '300px',
                  height: '300px',
                  borderRadius: '15px',
                  overflow: 'hidden',
                  border: '3px solid #3eb489',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#fff',
                }}
              >
                <img
                  src={mainImage.url}
                  alt={product.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}

            {/* Product Info */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                marginLeft: '40px',
                flex: 1,
                color: 'white',
              }}
            >
              {/* Brand */}
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  color: '#3eb489',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                }}
              >
                Minted Merch
              </div>

              {/* Product Title */}
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: '800',
                  lineHeight: '1.1',
                  marginBottom: '20px',
                  color: 'white',
                  maxWidth: '500px',
                }}
              >
                {product.title}
              </div>

              {/* Price */}
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
                    fontSize: '36px',
                    fontWeight: '700',
                    color: '#3eb489',
                  }}
                >
                  ${price}
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    color: '#888',
                    textTransform: 'uppercase',
                  }}
                >
                  USDC
                </div>
              </div>

              {/* Call to Action */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#3eb489',
                  padding: '15px 30px',
                  borderRadius: '10px',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: 'white',
                }}
              >
                🛒 Shop Now on Base
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              fontSize: '16px',
              color: '#888',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div>Pay with crypto • Powered by Farcaster</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': 'public, immutable, no-transform, max-age=300',
        },
      },
    );
  } catch (error) {
    console.error('Error generating product OG image:', error);
    
    // Return a fallback image
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
          }}
        >
          <div style={{ fontSize: '48px', fontWeight: '800' }}>
            Minted Merch Shop
          </div>
          <div style={{ fontSize: '24px', color: '#3eb489', marginTop: '20px' }}>
            Crypto Merch • Pay with USDC
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
} 