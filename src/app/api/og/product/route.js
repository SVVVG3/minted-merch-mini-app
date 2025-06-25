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
              id
              title
              handle
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
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
    const product = data?.product;

    if (!product) {
      throw new Error('Product not found');
    }

    const price = parseFloat(product.priceRange?.minVariantPrice?.amount || '0');
    const priceUSDC = (price / 3300).toFixed(2); // Convert to approximate USDC

    // Create rich branded product card (no external images)
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
            backgroundImage: 'linear-gradient(45deg, #1a1a1a 0%, #2d2d2d 100%)',
            fontFamily: 'Inter, sans-serif',
            position: 'relative',
            padding: '40px',
          }}
        >
          {/* Background pattern */}
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
          
          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(62, 180, 137, 0.3)',
              borderRadius: '20px',
              padding: '60px',
              maxWidth: '800px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Shopping cart icon */}
            <div
              style={{
                fontSize: '80px',
                marginBottom: '30px',
              }}
            >
              🛒
            </div>

            {/* Product title */}
            <h1
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: 'white',
                margin: '0 0 20px 0',
                lineHeight: '1.2',
                textAlign: 'center',
                maxWidth: '700px',
              }}
            >
              {product.title}
            </h1>

            {/* Price */}
            <div
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: '#3eb489',
                margin: '0 0 30px 0',
              }}
            >
              ${priceUSDC} USDC
            </div>

            {/* Call to action */}
            <div
              style={{
                fontSize: '24px',
                color: '#cccccc',
                margin: '0 0 20px 0',
              }}
            >
              Shop crypto merch with instant payments
            </div>

            {/* Base logo/branding */}
            <div
              style={{
                fontSize: '20px',
                color: '#3eb489',
                fontWeight: 'bold',
              }}
            >
              Pay on Base 🔵
            </div>
          </div>

          {/* Minted Merch branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px',
              fontSize: '18px',
              color: '#888888',
              fontWeight: 'bold',
            }}
          >
            mintedmerch.shop
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          // Follow official Farcaster caching patterns
          'Cache-Control': 'public, immutable, no-transform, max-age=31536000',
        },
      }
    );

  } catch (error) {
    console.error('Error generating product image:', error);
    
    // Return branded error image
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
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>🛒</div>
          <div style={{ fontSize: '32px', color: 'white', marginBottom: '10px' }}>
            Minted Merch Shop
          </div>
          <div style={{ fontSize: '24px', color: '#3eb489' }}>
            Shop crypto merch with USDC on Base 🔵
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, immutable, no-transform, max-age=31536000',
        },
      }
    );
  }
} 