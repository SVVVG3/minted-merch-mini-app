import { NextResponse } from 'next/server';
import { createOrder, updateOrderStatus, addTrackingInfo, getUserOrders } from '@/lib/orders';
import { checkUserNotificationStatus } from '@/lib/neynar';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('🧪 Testing order system...');

    const { searchParams } = new URL(request.url);
    const testFid = parseInt(searchParams.get('fid')) || 3621; // Default test FID

    // Test results object
    const results = {
      timestamp: new Date().toISOString(),
      testFid,
      tests: {}
    };

    // 1. Test Supabase connection
    console.log('1. Testing Supabase connection...');
    try {
      const { data, error } = await supabase.from('profiles').select('count(*)').single();
      results.tests.supabaseConnection = {
        success: !error,
        error: error?.message,
        profileCount: data?.count || 0
      };
    } catch (error) {
      results.tests.supabaseConnection = {
        success: false,
        error: error.message
      };
    }

    // 2. Test orders table exists
    console.log('2. Testing orders table...');
    try {
      const { data, error } = await supabase.from('orders').select('count(*)').single();
      results.tests.ordersTable = {
        success: !error,
        error: error?.message,
        orderCount: data?.count || 0
      };
    } catch (error) {
      results.tests.ordersTable = {
        success: false,
        error: error.message
      };
    }

    // 3. Test notification status check
    console.log('3. Testing notification status...');
    try {
      const notificationStatus = await checkUserNotificationStatus(testFid);
      results.tests.notificationStatus = {
        success: true,
        hasNotifications: notificationStatus.hasNotifications,
        tokenCount: notificationStatus.tokenCount,
        error: notificationStatus.error
      };
    } catch (error) {
      results.tests.notificationStatus = {
        success: false,
        error: error.message
      };
    }

    // 4. Test create order
    console.log('4. Testing create order...');
    const testOrderData = {
      fid: testFid,
      orderId: `test-order-${Date.now()}`,
      sessionId: `test-session-${Date.now()}`,
      status: 'pending',
      currency: 'USDC',
      amountTotal: 29.99,
      amountSubtotal: 24.99,
      amountTax: 2.00,
      amountShipping: 3.00,
      customerEmail: 'test@example.com',
      customerName: 'Test Customer',
      shippingAddress: {
        name: 'Test Customer',
        address1: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zip: '12345',
        country: 'US'
      },
      shippingMethod: 'Standard',
      shippingCost: 3.00,
      lineItems: [
        {
          id: 'test-product-1',
          title: 'Test Product',
          quantity: 1,
          price: 24.99,
          variant: 'Medium'
        }
      ],
      paymentMethod: 'USDC',
      paymentStatus: 'pending'
    };

    try {
      const createResult = await createOrder(testOrderData);
      results.tests.createOrder = {
        success: createResult.success,
        error: createResult.error,
        orderId: createResult.order?.order_id,
        orderDbId: createResult.order?.id
      };

      // Store order ID for subsequent tests
      if (createResult.success) {
        results.createdOrderId = createResult.order.order_id;
        results.createdOrderDbId = createResult.order.id;
      }
    } catch (error) {
      results.tests.createOrder = {
        success: false,
        error: error.message
      };
    }

    // 5. Test update order status (if order was created)
    if (results.createdOrderId) {
      console.log('5. Testing update order status to paid...');
      try {
        const updateResult = await updateOrderStatus(results.createdOrderId, 'paid', {
          paymentStatus: 'completed',
          paymentIntentId: 'test-payment-intent'
        });
        
        results.tests.updateOrderStatus = {
          success: updateResult.success,
          error: updateResult.error,
          newStatus: updateResult.order?.status,
          notificationSent: updateResult.order?.order_confirmation_sent
        };
      } catch (error) {
        results.tests.updateOrderStatus = {
          success: false,
          error: error.message
        };
      }
    }

    // 6. Test add tracking info (if order exists)
    if (results.createdOrderId) {
      console.log('6. Testing add tracking info...');
      try {
        const trackingResult = await addTrackingInfo(results.createdOrderId, {
          trackingNumber: 'TEST123456789',
          trackingUrl: 'https://tracking.example.com/TEST123456789',
          carrier: 'Test Carrier'
        });
        
        results.tests.addTracking = {
          success: trackingResult.success,
          error: trackingResult.error,
          trackingNumber: trackingResult.order?.tracking_number,
          shippingNotificationSent: trackingResult.order?.shipping_notification_sent
        };
      } catch (error) {
        results.tests.addTracking = {
          success: false,
          error: error.message
        };
      }
    }

    // 7. Test get user orders
    console.log('7. Testing get user orders...');
    try {
      const ordersResult = await getUserOrders(testFid);
      results.tests.getUserOrders = {
        success: ordersResult.success,
        error: ordersResult.error,
        orderCount: ordersResult.orders?.length || 0,
        orders: ordersResult.orders?.map(order => ({
          orderId: order.order_id,
          status: order.status,
          amount: order.amount_total,
          createdAt: order.created_at
        }))
      };
    } catch (error) {
      results.tests.getUserOrders = {
        success: false,
        error: error.message
      };
    }

    // 8. Clean up test order (optional)
    if (results.createdOrderDbId) {
      console.log('8. Cleaning up test order...');
      try {
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', results.createdOrderDbId);
        
        results.tests.cleanup = {
          success: !error,
          error: error?.message
        };
      } catch (error) {
        results.tests.cleanup = {
          success: false,
          error: error.message
        };
      }
    }

    // Summary
    const testCount = Object.keys(results.tests).length;
    const passedCount = Object.values(results.tests).filter(test => test.success).length;
    
    results.summary = {
      total: testCount,
      passed: passedCount,
      failed: testCount - passedCount,
      success: passedCount === testCount
    };

    console.log('✅ Order system test completed:', results.summary);

    return NextResponse.json(results);

  } catch (error) {
    console.error('❌ Error in order system test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 