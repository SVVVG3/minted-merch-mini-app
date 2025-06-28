export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle') || 'gdupi-cap';

    // Check environment variables
    const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
    
    const envCheck = {
      SHOPIFY_DOMAIN: SHOPIFY_DOMAIN ? 'SET' : 'MISSING',
      SHOPIFY_ACCESS_TOKEN: SHOPIFY_ACCESS_TOKEN ? 'SET' : 'MISSING',
      SHOPIFY_DOMAIN_VALUE: SHOPIFY_DOMAIN,
    };

    if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
      return Response.json({
        error: 'Missing Shopify environment variables',
        envCheck
      });
    }

    // Test Shopify API call
    const shopifyUrl = `https://${SHOPIFY_DOMAIN}.myshopify.com/api/2024-07/graphql.json`;
    
    const response = await fetch(shopifyUrl, {
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

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return Response.json({
        error: 'Failed to parse Shopify response',
        status: response.status,
        statusText: response.statusText,
        responseText,
        envCheck,
        shopifyUrl
      });
    }

    return Response.json({
      success: true,
      envCheck,
      shopifyUrl,
      shopifyResponse: {
        status: response.status,
        statusText: response.statusText,
        data
      },
      product: data.data?.product,
      handle
    });

  } catch (error) {
    return Response.json({
      error: 'Debug endpoint error',
      message: error.message,
      stack: error.stack
    });
  }
} 