import { NextResponse } from 'next/server';
import { createOrder } from '@/lib/orders';
import { getAuthenticatedFid, requireOwnFid } from '@/lib/userAuth';

export async function POST(request) {
  try {
    const orderData = await request.json();

    console.log('Creating new order:', orderData);

    // Validate required fields
    if (!orderData.fid || !orderData.orderId || !orderData.amountTotal || !orderData.lineItems) {
      console.error('Missing required fields in order data:', {
        hasFid: !!orderData.fid,
        hasOrderId: !!orderData.orderId,
        hasAmountTotal: !!orderData.amountTotal,
        hasLineItems: !!orderData.lineItems,
        fid: orderData.fid,
        fidType: typeof orderData.fid
      });
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: fid, orderId, amountTotal, lineItems'
      }, { status: 400 });
    }

    // 🔒 SECURITY FIX: Verify authenticated user can only create orders for themselves
    const authenticatedFid = await getAuthenticatedFid(request);
    const authCheck = requireOwnFid(authenticatedFid, orderData.fid);
    if (authCheck) return authCheck; // Returns 401 or 403 error if auth fails

    console.log(`✅ User FID ${authenticatedFid} authorized to create order for themselves`);

    // Create order in database
    const result = await createOrder(orderData);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: result.order
    });

  } catch (error) {
    console.error('Error in create order API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 