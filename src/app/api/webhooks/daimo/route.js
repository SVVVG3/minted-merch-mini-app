import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 🔒 SECURITY: Daimo Pay Webhook Handler with Signature Verification
 * 
 * This endpoint receives payment events from Daimo Pay and verifies them using
 * Basic Authentication with the webhook secret token provided by Daimo.
 * 
 * Daimo webhooks use: Authorization: Basic <token>
 * (The token is provided by Daimo when you create the webhook - use it as-is)
 * 
 * Events:
 * - payment_started: User initiated payment
 * - payment_completed: Payment confirmed on-chain
 * - payment_bounced: Destination call reverted, funds refunded
 * - payment_refunded: Refund sent to user
 */

export async function POST(request) {
  try {
    console.log('📩 Daimo webhook received');
    
    // 🔒 SECURITY CHECK 1: Verify webhook signature
    const authHeader = request.headers.get('authorization');
    const webhookSecret = process.env.DAIMO_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('❌ DAIMO_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }
    
    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      await logSecurityEvent('webhook_unauthorized', { reason: 'missing_auth_header' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Verify Basic Auth: Authorization: Basic <token>
    // Note: Daimo provides the token already formatted, no need to base64 encode
    const expectedAuth = `Basic ${webhookSecret}`;
    if (authHeader !== expectedAuth) {
      console.error('❌ Invalid webhook signature');
      await logSecurityEvent('webhook_signature_failed', {
        received: authHeader.substring(0, 20) + '...',
        reason: 'invalid_signature'
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    console.log('✅ Webhook signature verified');
    
    // Parse webhook event
    const event = await request.json();
    console.log('📦 Daimo webhook event:', {
      type: event.type,
      paymentId: event.paymentId,
      txHash: event.txHash
    });
    
    // 🔒 SECURITY CHECK 2: Log all webhook events for audit trail
    await logWebhookEvent(event);
    
    // Handle different event types
    switch (event.type) {
      case 'payment_started':
        await handlePaymentStarted(event);
        break;
      
      case 'payment_completed':
        await handlePaymentCompleted(event);
        break;
      
      case 'payment_bounced':
        await handlePaymentBounced(event);
        break;
      
      case 'payment_refunded':
        await handlePaymentRefunded(event);
        break;
      
      default:
        console.log(`ℹ️ Unknown event type: ${event.type}`);
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed',
      eventType: event.type
    });

  } catch (error) {
    console.error('❌ Daimo webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
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
        tx_hash: event.txHash,
        external_id: event.externalId || null,
        raw_payload: event,
        processed_at: new Date().toISOString()
      });
    console.log('✅ Webhook event logged to database');
  } catch (error) {
    console.error('❌ Failed to log webhook event:', error);
    // Don't fail the webhook if logging fails
  }
}

/**
 * Log security events
 */
async function logSecurityEvent(eventType, details) {
  try {
    await supabaseAdmin
      .from('security_events')
      .insert({
        event_type: eventType,
        details: details,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('❌ Failed to log security event:', error);
  }
}

/**
 * Handle payment_started event
 */
async function handlePaymentStarted(event) {
  console.log(`💰 Payment started: ${event.paymentId}`);
  
  // Find order by payment ID or external ID
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .or(`daimo_payment_id.eq.${event.paymentId},external_id.eq.${event.externalId}`)
    .single();
  
  if (order) {
    console.log(`📦 Found order: ${order.order_id}`);
    // Order exists - payment flow is proceeding normally
  } else {
    console.log(`⚠️ No order found for payment ${event.paymentId} - may be created soon`);
  }
}

/**
 * Handle payment_completed event
 * 🔒 SECURITY: Verify payment amount matches order amount
 */
async function handlePaymentCompleted(event) {
  console.log(`✅ Payment completed: ${event.paymentId}`);
  
  // Find order by Daimo payment ID
  const { data: order, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('daimo_payment_id', event.paymentId)
    .single();
  
  if (fetchError || !order) {
    console.error(`❌ Order not found for payment ${event.paymentId}`);
    await logSecurityEvent('payment_without_order', {
      paymentId: event.paymentId,
      txHash: event.txHash,
      amount: event.amount
    });
    return;
  }
  
  console.log(`📦 Found order: ${order.order_id}`);
  
  // 🔒 SECURITY: Verify payment amount matches order total
  const paidAmount = parseFloat(event.amount || event.toUnits || 0);
  const orderAmount = parseFloat(order.amount_total);
  const tolerance = 0.01; // Allow 1 cent tolerance for rounding
  
  if (Math.abs(paidAmount - orderAmount) > tolerance) {
    console.error(`❌ SECURITY ALERT: Payment amount mismatch!`, {
      orderId: order.order_id,
      expectedAmount: orderAmount,
      paidAmount: paidAmount,
      difference: Math.abs(paidAmount - orderAmount)
    });
    
    await logSecurityEvent('payment_amount_mismatch', {
      orderId: order.order_id,
      orderNumber: order.order_id,
      expectedAmount: orderAmount,
      paidAmount: paidAmount,
      paymentId: event.paymentId,
      txHash: event.txHash
    });
    
    // Don't mark order as paid if amount doesn't match
    return;
  }
  
  console.log(`✅ Payment amount verified: $${paidAmount}`);
  
  // Update order status
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'paid',
      payment_verified_at: new Date().toISOString(),
      daimo_tx_hash: event.txHash,
      daimo_source_chain: event.sourceChain || null,
      daimo_source_token: event.sourceToken || null
    })
    .eq('id', order.id);
  
  if (updateError) {
    console.error(`❌ Failed to update order ${order.order_id}:`, updateError);
  } else {
    console.log(`✅ Order ${order.order_id} marked as paid and verified`);
  }
}

/**
 * Handle payment_bounced event (refund due to failed destination call)
 */
async function handlePaymentBounced(event) {
  console.log(`⚠️ Payment bounced (refunded): ${event.paymentId}`);
  
  // Find and update order
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('daimo_payment_id', event.paymentId)
    .single();
  
  if (order) {
    await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'refunded',
        status: 'cancelled',
        refund_reason: event.reason || 'Payment bounced - destination call failed'
      })
      .eq('id', order.id);
    
    console.log(`📦 Order ${order.order_id} marked as refunded (bounced)`);
  }
}

/**
 * Handle payment_refunded event
 */
async function handlePaymentRefunded(event) {
  console.log(`💸 Payment refunded: ${event.paymentId}`);
  
  // Find and update order
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('daimo_payment_id', event.paymentId)
    .single();
  
  if (order) {
    await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'refunded',
        status: 'cancelled',
        refund_reason: event.reason || 'Payment refunded by Daimo'
      })
      .eq('id', order.id);
    
    console.log(`📦 Order ${order.order_id} marked as refunded`);
  }
}

/**
 * GET handler for webhook health check
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    service: 'daimo-pay-webhook',
    message: 'Webhook endpoint is active with signature verification enabled',
    timestamp: new Date().toISOString()
  });
}
