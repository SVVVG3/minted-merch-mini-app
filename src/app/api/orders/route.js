import { NextResponse } from 'next/server';
import { getOrder } from '@/lib/orders';

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

// Enhanced function to enrich line items with actual product titles
async function enrichLineItemsWithProductTitles(lineItems) {
  if (!lineItems || !Array.isArray(lineItems)) {
    return lineItems;
  }

  console.log(`🔍 Enriching ${lineItems.length} line items with product titles`);
  
  const enrichedItems = await Promise.all(
    lineItems.map(async (item) => {
      // Skip if title already exists and looks good
      if (item.title && !item.title.startsWith('Product') && item.title !== 'Item') {
        console.log(`✅ Item already has good title: ${item.title}`);
        return item;
      }

      // First try Storefront API
      const productInfo = await getProductFromVariantId(item.id);
      
      if (productInfo) {
        console.log(`✅ Found product via Storefront API: ${productInfo.productTitle} for variant ${extractVariantId(item.id)}`);
        return {
          ...item,
          title: productInfo.productTitle,
          variant_title: productInfo.variantTitle,
          variantId: productInfo.variantId
        };
      }

      // Final fallback: Create a meaningful name from variant ID
      const variantId = extractVariantId(item.id);
      const fallbackTitle = `Product #${variantId}`;
      
      console.log(`⚠️ Using fallback title: ${fallbackTitle} for variant ${variantId}`);
      return {
        ...item,
        title: fallbackTitle
      };
    })
  );

  return enrichedItems;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber');

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Order number is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching order details for:', orderNumber);

    // Use the getOrder function from lib/orders
    const orderResult = await getOrder(orderNumber);

    if (!orderResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: orderResult.error || 'Order not found'
        },
        { status: 404 }
      );
    }

    const order = orderResult.order;

    // Enrich line items with product titles if they exist
    let enrichedOrder = order;
    if (order.line_items && Array.isArray(order.line_items)) {
      console.log(`🔍 Enriching line items for order ${orderNumber}`);
      const enrichedLineItems = await enrichLineItemsWithProductTitles(order.line_items);
      enrichedOrder = {
        ...order,
        line_items: enrichedLineItems
      };
    }

    return NextResponse.json({
      success: true,
      order: enrichedOrder
    });

  } catch (error) {
    console.error('Error in orders API:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch order details',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 