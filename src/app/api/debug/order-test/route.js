import { createShopifyOrder } from '@/lib/shopifyAdmin';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('=== DEBUG ORDER TEST ===');
    
    // Test with minimal required data
    const testOrderData = {
      lineItems: [{
        variantId: 'gid://shopify/ProductVariant/48833051566387', // Use a real variant ID from your store
        quantity: 1,
        price: 10.00,
        name: 'Test Product',
        title: 'Test Variant'
      }],
      shippingAddress: {
        firstName: 'Test',
        lastName: 'Customer',
        address1: '123 Test St',
        address2: '',
        city: 'Test City',
        state: 'CA',
        zip: '90210',
        country: 'US',
        phone: '555-123-4567'
      },
      customer: {
        email: 'test@example.com',
        phone: '555-123-4567'
      },
      totalPrice: 15.00,
      subtotalPrice: 10.00,
      totalTax: 0.00,
      shippingLines: {
        title: 'Standard Shipping',
        price: 5.00,
        code: 'standard'
      },
      transactionHash: '0x1234567890abcdef',
      notes: 'Test order from debug endpoint'
    };

    console.log('Test order data:', JSON.stringify(testOrderData, null, 2));

    const result = await createShopifyOrder(testOrderData);
    
    console.log('Order creation result:', result);

    return NextResponse.json({
      success: true,
      result,
      message: 'Debug order test completed'
    });

  } catch (error) {
    console.error('Debug order test error:', error);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      details: 'Debug order creation failed'
    }, { status: 500 });
  }
} 