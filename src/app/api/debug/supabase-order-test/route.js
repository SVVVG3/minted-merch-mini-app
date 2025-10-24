import { withAdminAuth } from '@/lib/adminAuth';
export const POST = withAdminAuth(async (request, context) => {
  try {
    const { createOrder } = await import('@/lib/orders');
    const body = await request.json();
    
    console.log('🔍 Testing Supabase order creation with data:', body);
    
    // Create a test order based on the typical 100% discount order
    const testOrderData = {
      fid: body.fid || 12345, // Test FID
      orderId: `TEST-${Date.now()}`,
      sessionId: null,
      status: 'paid',
      currency: 'USDC',
      amountTotal: body.discountCode ? 4.75 : 34.72, // Just shipping if discount, full price if not
      amountSubtotal: body.discountCode ? 0 : 29.97, // 100% discount or full price
      amountTax: body.discountCode ? 0 : 0, // No tax for now
      amountShipping: 4.75,
      discountCode: body.discountCode || null,
      discountAmount: body.discountCode ? 29.97 : 0,
      discountPercentage: body.discountCode ? 100 : null,
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      shippingAddress: {
        firstName: 'Test',
        lastName: 'User',
        address1: '123 Test St',
        city: 'Test City',
        province: 'CA',
        zip: '90210',
        country: 'US',
        email: 'test@example.com'
      },
      shippingMethod: 'Standard',
      shippingCost: 4.75,
      lineItems: [{
        id: 'gid://shopify/ProductVariant/123456',
        title: 'Tiny Hyper Tee',
        quantity: 1,
        price: 29.97,
        variant: 'S',
        imageUrl: null
      }],
      paymentMethod: 'USDC',
      paymentStatus: 'completed',
      paymentIntentId: '0x123456789abcdef'
    };
    
    console.log('📝 Attempting to create order in Supabase...');
    const result = await createOrder(testOrderData);
    
    console.log('✅ Supabase order creation result:', result);
    
    return Response.json({
      success: true,
      message: 'Supabase order creation test completed',
      result: result,
      testData: testOrderData
    });
    
  } catch (error) {
    console.error('❌ Error in Supabase order test:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

export async function GET() {
  return Response.json({
    message: 'Supabase Order Creation Test',
    usage: 'POST with { fid: number, discountCode: string } to test order creation'
  });
} 