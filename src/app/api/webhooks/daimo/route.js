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
 * Daimo uses token-based auth: Authorization: Basic <token>
 * The token is provided when creating the webhook
 */
function verifyWebhookSignature(request) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.log('❌ Missing or invalid Authorization header');
    return false;
  }

  // Extract the token from "Basic <token>"
  const receivedToken = authHeader.replace('Basic ', '');
  
  // Get expected webhook token from environment
  const expectedToken = process.env.DAIMO_WEBHOOK_SECRET;
  
  if (!expectedToken) {
    console.error('❌ DAIMO_WEBHOOK_SECRET not configured in environment');
    return false;
  }

  // Daimo sends the token directly (not base64 encoded)
  // Compare the received token with our stored token
  const isValid = receivedToken === expectedToken;
  
  if (!isValid) {
    console.log('❌ Webhook signature verification failed');
    console.log('   Received token length:', receivedToken.length);
    console.log('   Expected token length:', expectedToken.length);
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
        external_id: event.payment?.externalId || null,
        tx_hash: event.txHash,
        chain_id: event.chainId ? String(event.chainId) : null,
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
    
    // Check if this is a test event
    const isTestEvent = event.isTestEvent === true;
    if (isTestEvent) {
      console.log('🧪 Daimo TEST webhook received (verified):', event.type);
    } else {
      console.log('📩 Daimo webhook received (verified):', event.type, event.paymentId);
    }

    // Log for audit trail (even test events)
    await logWebhookEvent(event);

    // Skip processing for test events (just acknowledge receipt)
    if (isTestEvent) {
      return NextResponse.json({ 
        success: true, 
        message: 'Test webhook received',
        eventType: event.type
      });
    }

    // Extract common fields from the webhook payload
    const { type, paymentId, chainId, txHash, payment } = event;
    const externalId = payment?.externalId || null;
    const metadata = payment?.metadata || {};

    // Handle different event types
    switch (type) {
      case 'payment_started':
        console.log('💰 Payment started:', {
          paymentId,
          externalId,
          chainId,
          txHash,
          sourceChain: payment?.source?.chainId,
          sourceToken: payment?.source?.tokenSymbol,
          payerAddress: payment?.source?.payerAddress
        });
        
        // Payment has been initiated on-chain
        // Order will be created when payment_completed fires
        
        break;

      case 'payment_completed':
        console.log('✅ Payment completed (webhook):', {
          paymentId,
          externalId,
          txHash,
          destinationChainId: chainId,
          sourceChainId: payment?.source?.chainId,
          amount: payment?.display?.paymentValue,
          destinationTxHash: payment?.destination?.txHash
        });
        
        // IMPORTANT: Payment is confirmed on-chain
        // The order should already be created by the client-side callback
        // This webhook serves as a backup verification and audit trail
        
        // Try to find the order by paymentId, txHash, or externalId
        let query = supabaseAdmin
          .from('orders')
          .select('id, orderId, payment_status, daimo_payment_id, transaction_hash');

        // Build OR query to find order
        const conditions = [];
        if (paymentId) conditions.push(`daimo_payment_id.eq.${paymentId}`);
        if (txHash) conditions.push(`transaction_hash.eq.${txHash}`);
        if (payment?.source?.txHash) conditions.push(`transaction_hash.eq.${payment.source.txHash}`);
        if (externalId) conditions.push(`orderId.eq.${externalId}`);
        
        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
        } else {
          console.warn('⚠️ No identifiers to search for order');
          break;
        }

        const { data: existingOrder, error: orderError } = await query.maybeSingle();

        if (orderError) {
          console.error('❌ Error checking order:', orderError);
        }

        if (existingOrder) {
          console.log('✅ Order found:', existingOrder.orderId);
          
          // Update payment verification status
          const updateData = {
            payment_verified_at: new Date().toISOString(),
            payment_verification_source: 'webhook'
          };
          
          // Add Daimo payment ID if not already set
          if (!existingOrder.daimo_payment_id && paymentId) {
            updateData.daimo_payment_id = paymentId;
          }
          
          // Update transaction hash if not already set (use destination tx)
          if (!existingOrder.transaction_hash && payment?.destination?.txHash) {
            updateData.transaction_hash = payment.destination.txHash;
          }
          
          await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', existingOrder.id);
            
          console.log('✅ Updated payment verification status');
        } else {
          console.warn('⚠️ Payment completed but no order found in database');
          console.warn('   This might indicate the client-side order creation failed');
          console.warn('   Order should be created via /api/shopify/orders when onPaymentCompleted fires');
          console.warn('   Identifiers:', { paymentId, txHash, externalId, sourceTxHash: payment?.source?.txHash });
        }
        
        break;

      case 'payment_bounced':
        console.log('⚠️ Payment bounced:', {
          paymentId,
          externalId,
          txHash,
          chainId
        });
        
        // Payment was sent but destination call failed
        // Funds are automatically refunded by Daimo
        // Mark any order as failed
        
        const { data: bouncedOrder } = await supabaseAdmin
          .from('orders')
          .select('id, orderId')
          .eq('daimo_payment_id', paymentId)
          .maybeSingle();
        
        if (bouncedOrder) {
          await supabaseAdmin
            .from('orders')
            .update({
              payment_status: 'failed',
              payment_failure_reason: 'Payment bounced - contract call reverted, funds refunded',
              updated_at: new Date().toISOString()
            })
            .eq('id', bouncedOrder.id);
          
          console.log('✅ Marked order as failed:', bouncedOrder.orderId);
        }
        
        break;

      case 'payment_refunded':
        console.log('💸 Payment refunded:', {
          paymentId,
          refundAddress: event.refundAddress,
          chainId: event.chainId,
          tokenAddress: event.tokenAddress,
          amountUnits: event.amountUnits,
          txHash: event.txHash
        });
        
        // A refund was sent (due to bounce, overpayment, etc.)
        // Update order status
        
        const { data: refundedOrder } = await supabaseAdmin
          .from('orders')
          .select('id, orderId')
          .eq('daimo_payment_id', paymentId)
          .maybeSingle();
        
        if (refundedOrder) {
          await supabaseAdmin
            .from('orders')
            .update({
              payment_status: 'refunded',
              refund_tx_hash: event.txHash,
              refunded_at: new Date().toISOString()
            })
            .eq('id', refundedOrder.id);
          
          console.log('✅ Marked order as refunded:', refundedOrder.orderId);
        }
        
        break;

      default:
        console.log('⚠️ Unknown Daimo webhook event type:', type);
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

