import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Daimo Pay Webhook Handler
 * 
 * Receives real-time payment notifications from Daimo:
 * - payment_started: User initiated payment
 * - payment_completed: Payment confirmed on-chain
 * - payment_bounced: Payment reverted, funds refunded
 * - payment_refunded: Refund sent
 * 
 * Security: Daimo webhooks use Basic Auth
 * Authorization: Basic <token> where token is provided when creating webhook
 * 
 * Webhook docs: https://paydocs.daimo.com/webhooks
 */

/**
 * Verify webhook signature from Daimo
 * Daimo uses Basic Auth: Authorization: Basic <base64(webhook_secret)>
 */
function verifyWebhookSignature(request) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.log('❌ Missing or invalid Authorization header');
    return false;
  }

  // Extract the token from "Basic <token>"
  const token = authHeader.replace('Basic ', '');
  
  // Get expected webhook secret from environment
  const expectedSecret = process.env.DAIMO_WEBHOOK_SECRET;
  
  if (!expectedSecret) {
    console.error('❌ DAIMO_WEBHOOK_SECRET not configured in environment');
    return false;
  }

  // Daimo sends the secret as-is in Basic Auth
  // Compare the received token with our stored secret
  const isValid = token === Buffer.from(expectedSecret).toString('base64');
  
  if (!isValid) {
    console.log('❌ Webhook signature verification failed');
  }
  
  return isValid;
}

/**
 * Log webhook event to database for audit trail
 */
async function logWebhookEvent(event) {
  try {
    await supabaseAdmin
      .from('webhook_logs')
      .insert({
        source: 'daimo',
        event_type: event.type,
        payment_id: event.paymentId,
        external_id: event.externalId,
        tx_hash: event.txHash,
        chain_id: event.chainId,
        raw_payload: event,
        processed_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log webhook event:', error);
    // Don't fail the webhook if logging fails
  }
}

export async function POST(request) {
  try {
    // SECURITY: Verify webhook signature first
    if (!verifyWebhookSignature(request)) {
      console.error('⚠️ Unauthorized webhook attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const event = await request.json();
    console.log('📩 Daimo webhook received (verified):', event);

    // Log for audit trail
    await logWebhookEvent(event);

    // Handle different event types
    switch (event.type) {
      case 'payment_started':
        console.log('💰 Payment started:', {
          paymentId: event.paymentId,
          externalId: event.externalId,
          chainId: event.chainId,
          txHash: event.txHash
        });
        
        // Payment has been initiated on-chain
        // We could update UI to show "processing" but order isn't created until completion
        
        break;

      case 'payment_completed':
        console.log('✅ Payment completed (webhook):', {
          paymentId: event.paymentId,
          externalId: event.externalId,
          txHash: event.txHash,
          chainId: event.chainId
        });
        
        // IMPORTANT: Payment is confirmed on-chain
        // The order should already be created by the client-side callback
        // This webhook serves as a backup verification and audit trail
        
        // Verify the order exists in our database
        const { data: existingOrder, error: orderError } = await supabaseAdmin
          .from('orders')
          .select('id, shopify_order_id, payment_status')
          .eq('daimo_payment_id', event.paymentId)
          .or(`transaction_hash.eq.${event.txHash},shopify_order_name.eq.${event.externalId}`)
          .single();

        if (orderError && orderError.code !== 'PGRST116') {
          console.error('Error checking order:', orderError);
        }

        if (existingOrder) {
          console.log('✅ Order already exists:', existingOrder.shopify_order_id);
          
          // Update payment status if needed
          if (existingOrder.payment_status !== 'paid') {
            await supabaseAdmin
              .from('orders')
              .update({
                payment_status: 'paid',
                payment_verified_at: new Date().toISOString(),
                payment_verification_source: 'webhook'
              })
              .eq('id', existingOrder.id);
            
            console.log('✅ Updated payment status to verified');
          }
        } else {
          console.warn('⚠️ Payment completed but no order found. This might indicate the client-side order creation failed.');
          console.warn('   Order should be created via /api/shopify/orders when onPaymentCompleted fires');
          console.warn('   Webhook serves as backup verification, not primary order creation');
        }
        
        break;

      case 'payment_bounced':
        console.log('⚠️ Payment bounced:', {
          paymentId: event.paymentId,
          externalId: event.externalId,
          txHash: event.txHash,
          reason: event.reason || 'Contract call reverted'
        });
        
        // Payment was sent but destination call failed
        // Funds are automatically refunded by Daimo
        // Mark any pending order as failed
        
        await supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'failed',
            payment_failure_reason: event.reason || 'Payment bounced - funds refunded',
            updated_at: new Date().toISOString()
          })
          .eq('daimo_payment_id', event.paymentId);
        
        break;

      case 'payment_refunded':
        console.log('💸 Payment refunded:', {
          paymentId: event.paymentId,
          externalId: event.externalId,
          refundTxHash: event.txHash
        });
        
        // A refund was sent (due to bounce, overpayment, etc.)
        // Update order status
        
        await supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'refunded',
            refund_tx_hash: event.txHash,
            refunded_at: new Date().toISOString()
          })
          .eq('daimo_payment_id', event.paymentId);
        
        break;

      default:
        console.log('⚠️ Unknown Daimo webhook event type:', event.type);
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed',
      eventType: event.type
    });

  } catch (error) {
    console.error('❌ Daimo webhook error:', error);
    
    // Return 200 to prevent Daimo from retrying
    // Log the error for investigation
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal processing error',
        message: error.message 
      },
      { status: 200 } // Return 200 to ack receipt even if processing failed
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

