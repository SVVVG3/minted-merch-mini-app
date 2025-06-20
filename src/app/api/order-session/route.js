import { kv } from '@/lib/kv';
import { getProductByHandle } from '@/lib/shopify';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { 
      productId,
      variantId, 
      variantPrice, // Price from frontend for validation
      quantity, 
      customer, 
      shippingAddress 
    } = await request.json();

    // Validate required fields
    if (!variantId || !quantity || !customer?.email || !shippingAddress?.address1 || !variantPrice) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate a unique session ID
    const sessionId = crypto.randomUUID();
    
    // Create session data with the price for verification
    const sessionData = {
      lineItems: [{
        variantId,
        quantity
      }],
      customer,
      shippingAddress,
      amount: variantPrice, // Store the expected amount
      createdAt: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes
    };

    // Store session in KV with 15-minute expiry
    await kv.set(
      `order_session:${sessionId}`, 
      sessionData,
      { ex: 900 } // 15 minutes in seconds
    );

    return NextResponse.json({
      sessionId,
      expiresAt: sessionData.expiresAt
    });

  } catch (error) {
    console.error('Order session error:', error);
    return NextResponse.json(
      { error: 'Failed to create order session' },
      { status: 500 }
    );
  }
}