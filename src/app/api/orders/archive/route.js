import { NextResponse } from 'next/server';
import { archiveOrder, getOrder } from '@/lib/orders';

export async function POST(request) {
  try {
    const { orderId, reason } = await request.json();

    console.log('Archiving order:', orderId, 'with reason:', reason);

    // Validate required fields
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: orderId'
      }, { status: 400 });
    }

    // Check if order exists
    const orderResult = await getOrder(orderId);
    if (!orderResult.success) {
      return NextResponse.json({
        success: false,
        error: `Order ${orderId} not found`
      }, { status: 404 });
    }

    // Archive the order
    const result = await archiveOrder(orderId, reason || 'manual_archive');

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: result.order,
      message: 'Order archived successfully'
    });

  } catch (error) {
    console.error('Error in archive order API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// GET endpoint to check if an order is archived
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Missing orderId parameter'
      }, { status: 400 });
    }

    const orderResult = await getOrder(orderId);
    
    if (!orderResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order: {
        orderId: orderResult.order.order_id,
        isArchived: !!orderResult.order.archived_at,
        archivedAt: orderResult.order.archived_at,
        archivedInShopify: orderResult.order.archived_in_shopify,
        status: orderResult.order.status
      }
    });

  } catch (error) {
    console.error('Error checking order archive status:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 