import { NextResponse } from 'next/server';

/**
 * Daimo Pay Webhook Handler
 * 
 * Receives real-time payment notifications from Daimo:
 * - payment_started: User initiated payment
 * - payment_completed: Payment confirmed on-chain
 * - payment_failed: Payment failed
 * 
 * Use this to update order status, send confirmations, etc.
 * 
 * Webhook events: https://docs.daimo.com/docs/pay/webhooks
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { event, data } = body;

    console.log('📩 Daimo webhook received:', { event, data });

    switch (event) {
      case 'payment_started':
        console.log('💰 Payment started:', {
          paymentId: data.paymentId,
          externalId: data.externalId,
          amount: data.amount,
          sourceChain: data.sourceChain,
          sourceToken: data.sourceToken
        });
        
        // TODO: Update order status to "processing"
        // Example: await updateOrderStatus(data.externalId, 'processing');
        
        break;

      case 'payment_completed':
        console.log('✅ Payment completed:', {
          paymentId: data.paymentId,
          externalId: data.externalId,
          txHash: data.txHash,
          amount: data.amount,
          destinationChain: data.destinationChain
        });
        
        // TODO: Update order status to "paid"
        // Example: await updateOrderStatus(data.externalId, 'paid');
        // TODO: Send confirmation email
        // Example: await sendOrderConfirmation(data.externalId);
        
        break;

      case 'payment_failed':
        console.log('❌ Payment failed:', {
          paymentId: data.paymentId,
          externalId: data.externalId,
          reason: data.reason
        });
        
        // TODO: Update order status to "failed"
        // Example: await updateOrderStatus(data.externalId, 'failed');
        
        break;

      default:
        console.log('⚠️ Unknown Daimo webhook event:', event);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed' 
    });

  } catch (error) {
    console.error('❌ Daimo webhook error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for webhook verification
 * Some webhook services ping the endpoint to verify it's active
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    service: 'daimo-pay-webhook',
    timestamp: new Date().toISOString()
  });
}

