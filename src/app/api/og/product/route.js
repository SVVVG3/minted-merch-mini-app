import { ImageResponse } from 'next/og';

// Remove edge runtime - use Node.js runtime for external image support
// export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
      throw new Error('Product handle is required');
    }

    // Fetch product data from Shopify using the correct domain format
    const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
      throw new Error('Missing Shopify environment variables');
    }

    const response = await fetch(`https://${SHOPIFY_DOMAIN}.myshopify.com/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: `
          query getProductByHandle($handle: String!) {
            product(handle: $handle) {
              title
              featuredImage {
                url
                altText
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        `,
        variables: { handle },
      }),
    });

    const data = await response.json();
    const product = data.data?.product;

    if (!product) {
      throw new Error('Product not found');
    }

    const productTitle = product.title;
    const productImage = product.featuredImage?.url;
    const price = product.priceRange?.minVariantPrice?.amount;

    // Fetch external image properly using Node.js runtime
    let imageData = null;
    if (productImage) {
      try {
        const imageResponse = await fetch(productImage);
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageData = arrayBuffer;
        }
      } catch (imageError) {
        console.error('Error loading product image:', imageError);
      }
    }

    // Create image element - use fetched image data or fallback
    const imageElement = imageData ? (
      <img
        src={productImage}
        width={400}
        height={400}
        style={{
          borderRadius: '16px',
          objectFit: 'cover',
        }}
        alt={product.featuredImage?.altText || productTitle}
      />
    ) : (
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
    );

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
            {/* Product Image */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {imageElement}
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
              
              {price && (
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
              )}
              
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