import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 🔒 SECURITY: Verify Daimo payment server-side using Daimo Payments API
 * 
 * This endpoint:
 * 1. Accepts payment ID and order details from client
 * 2. Verifies payment with Daimo API using DAIMO_API_KEY
 * 3. Validates payment amount matches expected order total
 * 4. Returns verification result
 * 
 * CRITICAL: Never trust client-side payment data. Always verify with Daimo.
 */

export async function POST(request) {
  try {
    const { 
      paymentId,           // Daimo payment ID
      expectedAmount,      // Expected payment amount (for validation)
      orderId,            // Order ID from our system
      orderData           // Full order data (for creating order after verification)
    } = await request.json();

    console.log('🔒 Payment verification request:', {
      paymentId,
      expectedAmount,
      orderId: orderId || 'new-order'
    });

    // Validate required fields
    if (!paymentId) {
      return NextResponse.json(
        { error: 'Missing paymentId' },
        { status: 400 }
      );
    }

    if (!expectedAmount || expectedAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid expected amount' },
        { status: 400 }
      );
    }

    // 🔒 SECURITY CHECK 1: Verify payment with Daimo API
    const daimoApiKey = process.env.DAIMO_API_KEY;
    
    if (!daimoApiKey) {
      console.error('❌ DAIMO_API_KEY not configured');
      return NextResponse.json(
        { error: 'Payment verification not configured' },
        { status: 500 }
      );
    }

    console.log('🔍 Verifying payment with Daimo API...');
    
    // Call Daimo Payments API to verify the payment
    // According to Daimo docs: GET https://pay.daimo.com/api/payments/{paymentId}
    const daimoResponse = await fetch(`https://pay.daimo.com/api/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${daimoApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!daimoResponse.ok) {
      const errorText = await daimoResponse.text();
      console.error('❌ Daimo API verification failed:', {
        status: daimoResponse.status,
        statusText: daimoResponse.statusText,
        error: errorText
      });
      
      // Log security event
      await logSecurityEvent('payment_verification_failed', {
        paymentId,
        expectedAmount,
        daimoStatus: daimoResponse.status,
        error: errorText
      });
      
      return NextResponse.json(
        { error: 'Payment verification failed', details: 'Invalid payment ID or payment not found' },
        { status: 400 }
      );
    }

    const paymentData = await daimoResponse.json();
    console.log('✅ Daimo payment data retrieved:', {
      id: paymentData.id,
      status: paymentData.status,
      amount: paymentData.amount,
      toChain: paymentData.toChain
    });

    // 🔒 SECURITY CHECK 2: Verify payment status
    if (paymentData.status !== 'completed' && paymentData.status !== 'success') {
      console.error('❌ Payment not completed:', paymentData.status);
      
      await logSecurityEvent('payment_incomplete', {
        paymentId,
        status: paymentData.status,
        expectedAmount
      });
      
      return NextResponse.json(
        { error: 'Payment not completed', status: paymentData.status },
        { status: 400 }
      );
    }

    // 🔒 SECURITY CHECK 3: Verify payment amount matches expected amount
    const paidAmount = parseFloat(paymentData.amount || paymentData.toUnits || 0);
    const expectedAmountNum = parseFloat(expectedAmount);
    const tolerance = 0.01; // Allow 1 cent tolerance for rounding

    if (Math.abs(paidAmount - expectedAmountNum) > tolerance) {
      console.error('❌ SECURITY ALERT: Payment amount mismatch!', {
        expected: expectedAmountNum,
        actual: paidAmount,
        difference: Math.abs(paidAmount - expectedAmountNum)
      });
      
      await logSecurityEvent('payment_amount_mismatch', {
        paymentId,
        expectedAmount: expectedAmountNum,
        paidAmount,
        difference: Math.abs(paidAmount - expectedAmountNum),
        orderId
      });
      
      return NextResponse.json(
        { 
          error: 'Payment amount mismatch',
          expected: expectedAmountNum,
          actual: paidAmount
        },
        { status: 400 }
      );
    }

    console.log(`✅ Payment amount verified: $${paidAmount}`);

    // 🔒 SECURITY CHECK 4: Check if payment already used (prevent replay attacks)
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('order_id, id')
      .eq('daimo_payment_id', paymentId)
      .single();

    if (existingOrder) {
      console.error('❌ SECURITY ALERT: Payment already used for order:', existingOrder.order_id);
      
      await logSecurityEvent('payment_replay_attempt', {
        paymentId,
        existingOrderId: existingOrder.order_id,
        attemptedOrderId: orderId
      });
      
      return NextResponse.json(
        { 
          error: 'Payment already used',
          orderId: existingOrder.order_id
        },
        { status: 400 }
      );
    }

    console.log('✅ Payment is valid and unused');

    // All security checks passed - payment is verified!
    return NextResponse.json({
      success: true,
      verified: true,
      payment: {
        id: paymentData.id,
        status: paymentData.status,
        amount: paidAmount,
        txHash: paymentData.txHash || paymentData.transactionHash,
        sourceChain: paymentData.fromChain || paymentData.sourceChain,
        sourceToken: paymentData.fromToken || paymentData.sourceToken,
        toChain: paymentData.toChain,
        toToken: paymentData.toToken
      }
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    await logSecurityEvent('payment_verification_error', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { error: 'Payment verification failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Log security events for audit trail
 */
async function logSecurityEvent(eventType, details) {
  try {
    await supabaseAdmin
      .from('security_audit_log')
      .insert({
        event_type: eventType,
        details: details,
        created_at: new Date().toISOString()
      });
    console.log('🔒 Security event logged:', eventType);
  } catch (error) {
    console.error('❌ Failed to log security event:', error);
    // Don't fail the request if logging fails
  }
}

/**
 * GET handler - return API status
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'daimo-payment-verification',
    message: 'Payment verification endpoint with Daimo API integration',
    timestamp: new Date().toISOString()
  });
}
