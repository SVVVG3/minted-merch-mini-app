import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: "Order Creation Debug Test",
    usage: "POST /api/debug/order-creation-test with sample order data to test the order creation flow"
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Use provided data or create sample test data
    const testOrderData = body.orderData || {
      cartItems: [
        {
          variant: { id: "gid://shopify/ProductVariant/test123" },
          quantity: 1,
          price: 29.99,
          product: {
            title: "Test Product",
            handle: "test-product",
            image: { url: "https://example.com/test.jpg" }
          },
          variant: {
            title: "Default Title",
            id: "gid://shopify/ProductVariant/test123"
          }
        }
      ],
      shippingAddress: {
        firstName: "Test",
        lastName: "User",
        address1: "123 Test St",
        city: "Test City",
        province: "CA",
        zip: "12345",
        country: "United States",
        phone: "555-1234",
        email: "test@example.com"
      },
      customer: {
        email: "test@example.com",
        phone: "555-1234"
      },
      checkout: {
        subtotal: { amount: 29.99 },
        tax: { amount: 2.40 },
        total: { amount: 37.14 }
      },
      selectedShipping: {
        title: "Standard Shipping",
        price: { amount: 4.75 },
        code: "standard"
      },
      transactionHash: "0x1234567890abcdef1234567890abcdef12345678",
      notes: "Test order from debug endpoint",
      fid: 12345, // Test FID
      appliedDiscount: null,
      discountAmount: 0
    };

    console.log('🧪 DEBUG: Testing order creation with data:', {
      hasCartItems: !!testOrderData.cartItems,
      cartItemsLength: testOrderData.cartItems?.length,
      hasShippingAddress: !!testOrderData.shippingAddress,
      hasTransactionHash: !!testOrderData.transactionHash,
      transactionHash: testOrderData.transactionHash,
      customerEmail: testOrderData.customer?.email,
      timestamp: new Date().toISOString()
    });

    // Call the order creation API directly
    const orderResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/shopify/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testOrderData),
    });

    const orderResult = await orderResponse.json();

    console.log('🧪 DEBUG: Order creation response:', {
      status: orderResponse.status,
      success: orderResult.success,
      hasOrder: !!orderResult.order,
      orderName: orderResult.order?.name,
      error: orderResult.error
    });

    // Check if order was created in Shopify
    let shopifyOrderCheck = null;
    if (orderResult.success && orderResult.order?.name) {
      try {
        const shopifyResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/shopify/orders?orderId=${orderResult.order.name}`);
        shopifyOrderCheck = await shopifyResponse.json();
      } catch (error) {
        console.error('Error checking Shopify order:', error);
        shopifyOrderCheck = { error: error.message };
      }
    }

    // Check if order was created in Supabase
    let supabaseOrderCheck = null;
    if (orderResult.success && orderResult.order?.name) {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: supabaseOrder, error: supabaseError } = await supabase
          .from('orders')
          .select('*')
          .eq('order_id', orderResult.order.name)
          .single();
        
        supabaseOrderCheck = supabaseError ? { error: supabaseError.message } : { order: supabaseOrder };
      } catch (error) {
        console.error('Error checking Supabase order:', error);
        supabaseOrderCheck = { error: error.message };
      }
    }

    return NextResponse.json({
      success: true,
      test: "order-creation",
      timestamp: new Date().toISOString(),
      orderCreationResult: {
        apiResponse: {
          status: orderResponse.status,
          success: orderResult.success,
          order: orderResult.order,
          error: orderResult.error
        },
        shopifyOrderCheck,
        supabaseOrderCheck
      },
      summary: {
        orderCreationSucceeded: orderResult.success,
        orderName: orderResult.order?.name || null,
        shopifyOrderExists: shopifyOrderCheck?.order ? true : false,
        supabaseOrderExists: supabaseOrderCheck?.order ? true : false,
        issues: [
          ...(orderResult.success ? [] : ['Order creation API failed']),
          ...(shopifyOrderCheck?.error ? ['Shopify order not found'] : []),
          ...(supabaseOrderCheck?.error ? ['Supabase order not found'] : [])
        ]
      }
    });

  } catch (error) {
    console.error('🧪 DEBUG: Order creation test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 