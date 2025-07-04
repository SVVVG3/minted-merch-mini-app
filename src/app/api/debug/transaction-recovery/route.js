import { NextResponse } from 'next/server';
import { createOrder } from '@/lib/orders';
import { shopifyAdminFetch } from '@/lib/shopifyAdmin';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { transactionHash, userDetails, orderDetails } = await request.json();
    
    console.log('🚨 EMERGENCY ORDER RECOVERY for transaction:', transactionHash);
    console.log('User details:', userDetails);
    console.log('Order details:', orderDetails);
    
    if (!transactionHash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 });
    }
    
    // First, check if order already exists
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('*')
      .ilike('payment_intent_id', `%${transactionHash}%`)
      .limit(1);
    
    if (existingOrders && existingOrders.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Order already exists',
        orderId: existingOrders[0].order_id
      });
    }
    
    // Create order manually with provided details
    const orderData = {
      fid: userDetails.fid || null,
      orderId: `#RECOVERY-${Date.now()}`, // Temporary order ID
      sessionId: null,
      status: 'paid',
      currency: 'USDC',
      amountTotal: orderDetails.total,
      amountSubtotal: orderDetails.subtotal,
      amountTax: orderDetails.tax || 0,
      amountShipping: orderDetails.shipping || 0,
      discountCode: orderDetails.discountCode || null,
      discountAmount: orderDetails.discountAmount || 0,
      discountPercentage: orderDetails.discountPercentage || null,
      customerEmail: userDetails.email || '',
      customerName: userDetails.name || '',
      shippingAddress: userDetails.shippingAddress,
      shippingMethod: orderDetails.shippingMethod || 'Standard Shipping',
      shippingCost: orderDetails.shipping || 0,
      lineItems: orderDetails.lineItems || [],
      paymentMethod: 'USDC on Base',
      paymentStatus: 'completed',
      paymentIntentId: transactionHash,
    };
    
    console.log('📦 Creating recovery order with data:', orderData);
    
    // Create order in Supabase
    const result = await createOrder(orderData);
    
    if (!result.success) {
      throw new Error(`Failed to create recovery order: ${result.error}`);
    }
    
    console.log('✅ Recovery order created:', result.order.order_id);
    
    // TODO: Create corresponding Shopify order
    // This would need to be done manually via Shopify Admin API
    
    return NextResponse.json({
      success: true,
      message: 'Order recovered successfully',
      orderId: result.order.order_id,
      transactionHash
    });
    
  } catch (error) {
    console.error('❌ Transaction recovery failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to lookup transaction details
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get('tx');
    
    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash required' }, { status: 400 });
    }
    
    // Search for any mention of this transaction in our database
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .or(`payment_intent_id.ilike.%${txHash}%,order_id.ilike.%${txHash}%`)
      .limit(5);
    
    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      foundOrders: orders || [],
      message: orders && orders.length > 0 ? 'Found existing orders' : 'No orders found for this transaction'
    });
    
  } catch (error) {
    console.error('❌ Transaction lookup failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 