import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
      throw new Error('Product handle is required');
    }

    // Fetch product data from Shopify
    const response = await fetch(`${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: `
          query getProduct($handle: String!) {
            product(handle: $handle) {
              title
              description
              priceRange {
                minVariantPrice {
                  amount
                }
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
            }
          }
        `,
        variables: { handle },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch product');
    }

    const { data } = await response.json();
    const product = data.product;

    if (!product) {
      throw new Error('Product not found');
    }

    const mainImage = product.images?.edges?.[0]?.node;
    const price = product.priceRange?.minVariantPrice?.amount || '0';

    // Create rich product card without external image for now
    const imageElement = (
      <div
        style={{
          width: '300px',
          height: '300px',
          borderRadius: '15px',
          border: '3px solid #3eb489',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '15px',
          backgroundColor: 'rgba(62, 180, 137, 0.1)',
          color: '#3eb489',
        }}
      >
        <div style={{ fontSize: '64px' }}>🛒</div>
        <div 
          style={{ 
            fontSize: '18px', 
            fontWeight: '600',
            textAlign: 'center',
            maxWidth: '250px',
            lineHeight: '1.2',
          }}
        >
          {product.title}
        </div>
        <div 
          style={{ 
            fontSize: '24px', 
            fontWeight: '700',
            color: '#3eb489',
          }}
        >
          ${price}
        </div>
      </div>
    );
    
    const imageLoadedSuccessfully = true; // Always use normal cache time

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
              {imageElement}
            </div>

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
          // Use shorter cache time if image failed to load
          'Cache-Control': imageLoadedSuccessfully 
            ? 'public, immutable, no-transform, max-age=300'
            : 'public, immutable, no-transform, max-age=60',
        },
      },
    );
  } catch (error) {
    console.error('Error generating product OG image:', error);
    
    // Return a fallback image with short cache time
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
        headers: {
          // Short cache time for error images
          'Cache-Control': 'public, immutable, no-transform, max-age=30',
        },
      },
    );
  }
} 