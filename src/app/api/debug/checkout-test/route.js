import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    console.log('Checkout test - received data:', {
      hasFid: !!body.fid,
      fid: body.fid,
      hasCustomer: !!body.customer,
      customerEmail: body.customer?.email,
      hasShippingAddress: !!body.shippingAddress,
      shippingEmail: body.shippingAddress?.email,
      hasTransactionHash: !!body.transactionHash,
      transactionHash: body.transactionHash,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      received: {
        fid: body.fid,
        fidType: typeof body.fid,
        hasCustomer: !!body.customer,
        customerEmail: body.customer?.email,
        hasShippingAddress: !!body.shippingAddress,
        shippingEmail: body.shippingAddress?.email,
        hasTransactionHash: !!body.transactionHash,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Checkout test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 