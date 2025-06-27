import { NextResponse } from 'next/server';
import { createOrderFromSession } from '@/lib/order';

// Removed edge runtime due to Supabase client compatibility issues

export async function POST(request) {
  try {
    const { sessionId, transactionHash } = await request.json();

    if (!sessionId || !transactionHash) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Create order from session (this will verify the transaction)
    const order = await createOrderFromSession(sessionId, transactionHash);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        name: order.name,
        status: order.displayFinancialStatus,
        total: order.totalPriceSet.shopMoney,
        customer: order.customer
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 400 }
    );
  }
}