import { NextResponse } from 'next/server';
import { getUserOrders } from '@/lib/orders';
import { supabase } from '@/lib/supabase';

// Helper function to extract variant ID from Shopify GraphQL ID
function extractVariantId(graphqlId) {
  if (typeof graphqlId === 'string' && graphqlId.includes('ProductVariant/')) {
    return graphqlId.split('ProductVariant/')[1];
  }
  return graphqlId;
}

// Helper function to get product details from Shopify variant ID
async function getProductFromVariantId(variantId) {
  try {
    const cleanVariantId = extractVariantId(variantId);
    
    const response = await fetch(
      `https://${process.env.SHOPIFY_SITE_DOMAIN}.myshopify.com/admin/api/2023-10/variants/${cleanVariantId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log(`❌ Failed to fetch variant ${cleanVariantId}:`, response.status);
      return null;
    }

    const variantData = await response.json();
    
    if (variantData.variant && variantData.variant.product_id) {
      // Now get the product details
      const productResponse = await fetch(
        `https://${process.env.SHOPIFY_SITE_DOMAIN}.myshopify.com/admin/api/2023-10/products/${variantData.variant.product_id}.json`,
        {
          headers: {
            'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      );

      if (productResponse.ok) {
        const productData = await productResponse.json();
        return {
          productTitle: productData.product.title,
          variantTitle: variantData.variant.title,
          productId: variantData.variant.product_id,
          variantId: cleanVariantId
        };
      }
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
        return item;
      }

      // Try to get product title from Shopify variant ID
      const productInfo = await getProductFromVariantId(item.id);
      
      if (productInfo) {
        console.log(`✅ Found product: ${productInfo.productTitle} for variant ${extractVariantId(item.id)}`);
        return {
          ...item,
          title: productInfo.productTitle,
          variant: productInfo.variantTitle,
          productId: productInfo.productId,
          variantId: productInfo.variantId
        };
      }

      // Fallback: Create a meaningful name from variant ID
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

    console.log('🔍 Fetching orders for FID:', fid, 'limit:', limit, 'includeArchived:', includeArchived);

    // Get orders from database
    let query = supabase
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