import { NextResponse } from 'next/server';
import { getUserOrders } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import { enrichLineItemsWithProductTitles } from '@/lib/shopifyProductHelper';

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
    const result = await getUserOrders(parseInt(fid), limit, includeArchived);

    if (!result.success) {
      console.error('❌ Error fetching user orders:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    const orders = result.orders || [];

    // Calculate statistics
    const stats = {
      totalOrders: orders.length,
      totalSpent: orders.reduce((sum, order) => {
        return sum + (parseFloat(order.amount_total) || 0);
      }, 0),
      lastOrderDate: orders.length > 0 ? orders[0].created_at : null
    };

    // Enrich line items with product titles for older orders that might be missing them
    const ordersWithEnrichedLineItems = await Promise.all(
      orders.map(async (order) => {
        if (order.line_items && order.line_items.length > 0) {
          try {
            const enrichedLineItems = await enrichLineItemsWithProductTitles(order.line_items);
            return {
              ...order,
              line_items: enrichedLineItems
            };
          } catch (error) {
            console.error('Error enriching line items for order', order.order_id, ':', error);
            return order; // Return original order if enrichment fails
          }
        }
        return order;
      })
    );

    // Transform orders to match frontend expectations
    const transformedOrders = ordersWithEnrichedLineItems.map(order => ({
      // Order identification
      orderId: order.order_id,
      name: order.order_id, // Using order_id as the name for consistency
      
      // Status and timing
      status: capitalizeStatus(order.status),
      timestamp: order.created_at,
      
      // Financial details
      total: {
        amount: parseFloat(order.amount_total || 0).toFixed(2),
        currencyCode: order.currency || 'USDC'
      },
      subtotal: parseFloat(order.amount_subtotal || 0),
      tax: parseFloat(order.amount_tax || 0),
      shipping: parseFloat(order.amount_shipping || 0),
      
      // Discount information
      discountCode: order.discount_code,
      discountAmount: parseFloat(order.discount_amount || 0),
      discountPercentage: order.discount_percentage,
      
      // Customer information
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      
      // Shipping details
      shippingAddress: order.shipping_address,
      shippingMethod: order.shipping_method,
      
      // Line items
      lineItems: order.line_items || [],
      
      // Payment details
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      transactionHash: order.payment_intent_id, // This contains the transaction hash
      
      // Additional metadata
      sessionId: order.session_id,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      shippedAt: order.shipped_at,
      deliveredAt: order.delivered_at,
      
      // Flags
      isArchived: !!order.archived_at,
      confirmationSent: order.order_confirmation_sent,
      shippingNotificationSent: order.shipping_notification_sent
    }));

    console.log('✅ Fetched', transformedOrders.length, 'orders for FID:', fid);
    console.log('📊 Stats:', stats);

    return NextResponse.json({
      success: true,
      orders: transformedOrders,
      stats,
      fid: parseInt(fid),
      count: transformedOrders.length
    });

  } catch (error) {
    console.error('❌ Error in user orders API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch user orders',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Helper function to capitalize status for display
function capitalizeStatus(status) {
  if (!status) return 'Unknown';
  
  const statusMap = {
    'pending': 'Pending',
    'paid': 'Confirmed',
    'shipped': 'Shipped',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
    'refunded': 'Refunded'
  };
  
  return statusMap[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
} 