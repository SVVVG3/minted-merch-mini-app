import { NextResponse } from 'next/server';
import { getUserOrders } from '@/lib/orders';
import { supabaseAdmin } from '@/lib/supabase';

// Helper function to extract variant ID from Shopify GraphQL ID
function extractVariantId(graphqlId) {
  if (typeof graphqlId === 'string' && graphqlId.includes('ProductVariant/')) {
    return graphqlId.split('ProductVariant/')[1];
  }
  return graphqlId;
}

// Helper function to get product details from Shopify Storefront API
async function getProductFromVariantId(variantId) {
  try {
    const cleanVariantId = extractVariantId(variantId);
    const variantGraphqlId = `gid://shopify/ProductVariant/${cleanVariantId}`;
    
    // Use Shopify Storefront API instead of Admin API
    const storefrontQuery = `
      query getVariant($id: ID!) {
        node(id: $id) {
          ... on ProductVariant {
            title
            product {
              title
            }
          }
        }
      }
    `;
    
    const response = await fetch(
      `https://${process.env.SHOPIFY_SITE_DOMAIN}.myshopify.com/api/2023-10/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
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

// Fallback: Check our products table for known products
async function getProductFromDatabase(variantId) {
  try {
    const cleanVariantId = extractVariantId(variantId);
    
    // This is a basic fallback - in a real scenario you'd have a variants table
    // For now, let's just return null and let the Storefront API handle it
    return null;
  } catch (error) {
    console.log(`❌ Error checking database for variant ${variantId}:`, error.message);
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
          variant: productInfo.variantTitle,
          variantId: productInfo.variantId
        };
      }

      // Fallback to database check
      const dbProduct = await getProductFromDatabase(item.id);
      
      if (dbProduct) {
        console.log(`✅ Found product in database: ${dbProduct.productTitle} for variant ${extractVariantId(item.id)}`);
        return {
          ...item,
          title: dbProduct.productTitle,
          variant: dbProduct.variantTitle,
          variantId: dbProduct.variantId
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
    const fid = searchParams.get('fid');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const includeArchived = searchParams.get('includeArchived') === 'true';

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // 🔒 SECURITY FIX: Verify user can only access their own orders
    const { getAuthenticatedFid, requireOwnFid } = await import('@/lib/userAuth');
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    console.log('🔍 Fetching orders for authenticated user FID:', fid, 'limit:', limit, 'includeArchived:', includeArchived);

    // Get orders from database using admin client
    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('fid', fid)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Only include non-archived orders unless specifically requested
    if (!includeArchived) {
      query = query.is('archived_at', null);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders from database' },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      console.log('📝 No orders found for FID:', fid);
      return NextResponse.json({
        orders: [],
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null
      });
    }

    console.log(`📦 Found ${orders.length} orders, enriching with product titles...`);

    // Enrich orders with proper product titles
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        if (order.line_items && Array.isArray(order.line_items)) {
          const enrichedLineItems = await enrichLineItemsWithProductTitles(order.line_items);
          return {
            ...order,
            lineItems: enrichedLineItems
          };
        }
        return {
          ...order,
          lineItems: order.line_items || []
        };
      })
    );

    // Calculate statistics
    const totalOrders = enrichedOrders.length;
    const totalSpent = enrichedOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.amount_total) || 0);
    }, 0);
    
    const lastOrderDate = enrichedOrders.length > 0 
      ? enrichedOrders[0].created_at 
      : null;

    console.log(`✅ Successfully enriched ${enrichedOrders.length} orders with product titles`);

    return NextResponse.json({
      orders: enrichedOrders,
      totalOrders,
      totalSpent,
      lastOrderDate
    });

  } catch (error) {
    console.error('❌ API Error in user-orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 