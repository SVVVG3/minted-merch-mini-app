import { NextResponse } from 'next/server';

// Helper function to extract variant ID from GraphQL ID
function extractVariantId(graphqlId) {
  if (!graphqlId) return null;
  const match = graphqlId.match(/ProductVariant\/(\d+)/);
  return match ? match[1] : graphqlId;
}

// Get product info from Shopify Storefront API using variant ID
async function getProductFromVariantId(variantId) {
  try {
    const cleanVariantId = extractVariantId(variantId);
    
    if (!cleanVariantId) {
      console.log(`❌ Invalid variant ID: ${variantId}`);
      return null;
    }

    console.log(`🔍 Fetching product for variant ${cleanVariantId} from Storefront API`);
    
    // Convert to GraphQL ID format
    const variantGraphqlId = `gid://shopify/ProductVariant/${cleanVariantId}`;
    
    // GraphQL query to get product and variant info
    const storefrontQuery = `
      query GetVariantProduct($id: ID!) {
        node(id: $id) {
          ... on ProductVariant {
            id
            title
            product {
              title
              handle
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/api/2023-10/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({
          query: storefrontQuery,
          variables: { id: variantGraphqlId }
        })
      }
    );

    if (!response.ok) {
      console.log(`❌ Failed to fetch variant ${cleanVariantId} from Storefront API:`, response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.errors) {
      console.log(`❌ GraphQL errors for variant ${cleanVariantId}:`, data.errors);
      return null;
    }
    
    if (data.data?.node?.product) {
      return {
        productTitle: data.data.node.product.title,
        variantTitle: data.data.node.title,
        variantId: cleanVariantId
      };
    }
    
    return null;
  } catch (error) {
    console.log(`❌ Error fetching product for variant ${variantId}:`, error.message);
    return null;
  }
}

export async function GET() {
  try {
    console.log('🧪 Testing product enrichment for Order #1268 variants...');
    
    const testVariants = [
      'gid://shopify/ProductVariant/50352720183577', // Bankr Cap
      'gid://shopify/ProductVariant/47170056356121'  // Second product
    ];
    
    const results = [];
    
    for (const variantId of testVariants) {
      console.log(`\n🔍 Testing variant: ${variantId}`);
      
      const cleanId = extractVariantId(variantId);
      console.log(`Clean ID: ${cleanId}`);
      
      const productInfo = await getProductFromVariantId(variantId);
      
      results.push({
        originalVariantId: variantId,
        cleanVariantId: cleanId,
        productInfo: productInfo,
        success: !!productInfo
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Product enrichment test completed',
      results: results,
      environment: {
        hasStoreDomain: !!process.env.SHOPIFY_STORE_DOMAIN,
        hasAccessToken: !!process.env.SHOPIFY_ACCESS_TOKEN,
        storeDomain: process.env.SHOPIFY_STORE_DOMAIN ? `${process.env.SHOPIFY_STORE_DOMAIN.substring(0, 10)}...` : 'undefined'
      }
    });
    
  } catch (error) {
    console.error('❌ Test product enrichment error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 