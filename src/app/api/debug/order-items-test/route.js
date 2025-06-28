import { NextResponse } from 'next/server';
import { createOrder, archiveOrder, getUserOrders, getOrder } from '@/lib/orders';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const results = [];
  let successCount = 0;
  const totalTests = 8;
  
  console.log('🧪 Testing order items and archiving system...');

  // Test 1: Database Connection
  try {
    const { data, error } = await supabase.from('orders').select('count(*)').single();
    results.push({ 
      test: 1, 
      name: 'Database Connection', 
      status: '✅ PASS', 
      details: `Connected successfully. ${data?.count || 0} orders in database` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 1, name: 'Database Connection', status: '❌ FAIL', error: error.message });
  }

  // Test 2: Create Test Order with Line Items
  let testOrderId = null;
  let testOrderDbId = null;
  try {
    const testFid = 99999;
    
    // Clean up any existing test data
    await supabase.from('orders').delete().eq('fid', testFid);
    await supabase.from('profiles').delete().eq('fid', testFid);
    
    // Create test profile
    await supabase.from('profiles').insert({ 
      fid: testFid, 
      username: 'testuser99999', 
      display_name: 'Test User' 
    });

    const orderData = {
      fid: testFid,
      orderId: `TEST-ORDER-${Date.now()}`,
      status: 'paid',
      currency: 'USDC',
      amountTotal: 100.00,
      amountSubtotal: 85.00,
      amountTax: 10.00,
      amountShipping: 5.00,
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      lineItems: [
        {
          id: 'test-product-1',
          title: 'Test Product 1',
          variant: 'Red / Large',
          variantId: 'test-variant-1',
          price: 50.00,
          quantity: 1,
          sku: 'TEST-SKU-1'
        },
        {
          id: 'test-product-2',
          title: 'Test Product 2',
          variant: 'Blue / Medium',
          variantId: 'test-variant-2',
          price: 35.00,
          quantity: 1,
          sku: 'TEST-SKU-2'
        }
      ],
      paymentMethod: 'USDC',
      paymentStatus: 'completed'
    };

    const orderResult = await createOrder(orderData);
    
    if (!orderResult.success) {
      throw new Error(orderResult.error);
    }
    
    testOrderId = orderResult.order.order_id;
    testOrderDbId = orderResult.order.id;
    
    results.push({ 
      test: 2, 
      name: 'Create Test Order with Line Items', 
      status: '✅ PASS', 
      details: `Order created: ${testOrderId}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 2, name: 'Create Test Order with Line Items', status: '❌ FAIL', error: error.message });
  }

  // Test 3: Verify Order Items Table Population
  try {
    if (!testOrderDbId) throw new Error('No test order ID available');
    
    const { data: orderItems, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', testOrderDbId);
    
    if (error) throw error;
    
    if (orderItems.length !== 2) {
      throw new Error(`Expected 2 order items, got ${orderItems.length}`);
    }
    
    // Verify data integrity
    const item1 = orderItems.find(item => item.product_title === 'Test Product 1');
    const item2 = orderItems.find(item => item.product_title === 'Test Product 2');
    
    if (!item1 || !item2) {
      throw new Error('Missing expected order items');
    }
    
    if (parseFloat(item1.price) !== 50.00 || parseFloat(item2.price) !== 35.00) {
      throw new Error('Incorrect pricing in order items');
    }
    
    results.push({ 
      test: 3, 
      name: 'Verify Order Items Table Population', 
      status: '✅ PASS', 
      details: `2 order items created correctly with proper data` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 3, name: 'Verify Order Items Table Population', status: '❌ FAIL', error: error.message });
  }

  // Test 4: Test Order Archiving (Not Deletion)
  try {
    if (!testOrderId) throw new Error('No test order ID available');
    
    const archiveResult = await archiveOrder(testOrderId, 'test_archive');
    
    if (!archiveResult.success) {
      throw new Error(archiveResult.error);
    }
    
    // Verify order still exists but is marked as archived
    const orderResult = await getOrder(testOrderId);
    
    if (!orderResult.success) {
      throw new Error('Order was deleted instead of archived!');
    }
    
    if (!orderResult.order.archived_at) {
      throw new Error('Order not properly marked as archived');
    }
    
    if (orderResult.order.status !== 'cancelled') {
      throw new Error('Order status not updated to cancelled');
    }
    
    results.push({ 
      test: 4, 
      name: 'Test Order Archiving (Not Deletion)', 
      status: '✅ PASS', 
      details: `Order archived at ${orderResult.order.archived_at}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 4, name: 'Test Order Archiving (Not Deletion)', status: '❌ FAIL', error: error.message });
  }

  // Test 5: Test getUserOrders Excludes Archived by Default
  try {
    const testFid = 99999;
    
    const ordersResult = await getUserOrders(testFid, 50, false); // Don't include archived
    
    if (!ordersResult.success) {
      throw new Error(ordersResult.error);
    }
    
    if (ordersResult.orders.length !== 0) {
      throw new Error(`Expected 0 orders (archived excluded), got ${ordersResult.orders.length}`);
    }
    
    results.push({ 
      test: 5, 
      name: 'Test getUserOrders Excludes Archived by Default', 
      status: '✅ PASS', 
      details: 'Archived orders correctly excluded from default query' 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 5, name: 'Test getUserOrders Excludes Archived by Default', status: '❌ FAIL', error: error.message });
  }

  // Test 6: Test getUserOrders Includes Archived When Requested
  try {
    const testFid = 99999;
    
    const ordersResult = await getUserOrders(testFid, 50, true); // Include archived
    
    if (!ordersResult.success) {
      throw new Error(ordersResult.error);
    }
    
    if (ordersResult.orders.length !== 1) {
      throw new Error(`Expected 1 order (including archived), got ${ordersResult.orders.length}`);
    }
    
    const order = ordersResult.orders[0];
    if (!order.archived_at) {
      throw new Error('Order should be marked as archived');
    }
    
    results.push({ 
      test: 6, 
      name: 'Test getUserOrders Includes Archived When Requested', 
      status: '✅ PASS', 
      details: 'Archived orders correctly included when requested' 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 6, name: 'Test getUserOrders Includes Archived When Requested', status: '❌ FAIL', error: error.message });
  }

  // Test 7: Verify Order Items Persist After Archiving
  try {
    if (!testOrderDbId) throw new Error('No test order DB ID available');
    
    const { data: orderItems, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', testOrderDbId);
    
    if (error) throw error;
    
    if (orderItems.length !== 2) {
      throw new Error(`Expected 2 order items after archiving, got ${orderItems.length}`);
    }
    
    results.push({ 
      test: 7, 
      name: 'Verify Order Items Persist After Archiving', 
      status: '✅ PASS', 
      details: 'Order items correctly preserved after order archiving' 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 7, name: 'Verify Order Items Persist After Archiving', status: '❌ FAIL', error: error.message });
  }

  // Test 8: Test Archive API Endpoint
  try {
    if (!testOrderId) throw new Error('No test order ID available');
    
    // Test the archive status API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/orders/archive?orderId=${testOrderId}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    if (!result.order.isArchived) {
      throw new Error('Archive API reports order is not archived');
    }
    
    if (!result.order.archivedAt) {
      throw new Error('Archive API missing archived timestamp');
    }
    
    results.push({ 
      test: 8, 
      name: 'Test Archive API Endpoint', 
      status: '✅ PASS', 
      details: `Archive API working correctly, archived at: ${result.order.archivedAt}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 8, name: 'Test Archive API Endpoint', status: '❌ FAIL', error: error.message });
  }

  // Clean up test data
  try {
    await supabase.from('orders').delete().eq('fid', 99999);
    await supabase.from('profiles').delete().eq('fid', 99999);
  } catch (error) {
    console.log('Cleanup error (non-critical):', error.message);
  }

  const successRate = (successCount / totalTests * 100).toFixed(1);

  return NextResponse.json({
    success: true,
    message: 'Order items and archiving system test completed',
    results: {
      timestamp: new Date().toISOString(),
      tests: results,
      summary: {
        passed: successCount,
        failed: totalTests - successCount,
        total: totalTests,
        successRate: `${successRate}%`
      }
    }
  });
} 