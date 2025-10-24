import { NextResponse } from 'next/server';
import { archiveOrder, cancelOrder, getOrder } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export async function GET() {
  const results = [];
  let successCount = 0;
  const totalTests = 6;
  
  console.log('🧪 Testing order status handling for archiving vs cancelling...');

  // Test 1: Check current order #1189 status
  try {
    const orderResult = await getOrder('#1189');
    
    if (!orderResult.success) {
      throw new Error('Order #1189 not found');
    }

    const order = orderResult.order;
    const expectedStatus = 'shipped'; // Should remain shipped when archived
    
    if (order.status !== expectedStatus) {
      throw new Error(`Expected status '${expectedStatus}', got '${order.status}'`);
    }

    if (!order.archived_at) {
      throw new Error('Order should be archived');
    }

    if (!order.archived_in_shopify) {
      throw new Error('Order should be marked as archived_in_shopify');
    }

    results.push({ 
      test: 1, 
      name: 'Check Order #1189 Status After Archive', 
      status: '✅ PASS', 
      details: `Status: ${order.status}, Archived: ${!!order.archived_at}, Archived in Shopify: ${order.archived_in_shopify}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 1, name: 'Check Order #1189 Status After Archive', status: '❌ FAIL', error: error.message });
  }

  // Test 2: Create a test order to test archiving behavior
  try {
    const testOrderId = '#TEST-ARCHIVE-' + Date.now();
    
    // Create a test order
    const { data: testOrder, error } = await supabase
      .from('orders')
      .insert({
        fid: 99999,
        order_id: testOrderId,
        status: 'delivered',
        currency: 'USDC',
        amount_total: 50.00,
        line_items: [{ id: 'test', title: 'Test Product', quantity: 1, price: 50.00 }],
        payment_method: 'USDC',
        payment_status: 'completed'
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create test order: ' + error.message);
    }

    results.push({ 
      test: 2, 
      name: 'Create Test Order for Archiving', 
      status: '✅ PASS', 
      details: `Created order ${testOrderId} with status: ${testOrder.status}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 2, name: 'Create Test Order for Archiving', status: '❌ FAIL', error: error.message });
  }

  // Test 3: Archive the test order and verify status is preserved
  try {
    const testOrderId = '#TEST-ARCHIVE-' + Date.now();
    
    // Get the test order ID from the previous test
    const { data: orders } = await supabase
      .from('orders')
      .select('order_id, status')
      .eq('fid', 99999)
      .like('order_id', '#TEST-ARCHIVE-%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!orders || orders.length === 0) {
      throw new Error('Test order not found');
    }

    const testOrder = orders[0];
    const originalStatus = testOrder.status;

    // Archive the order
    const archiveResult = await archiveOrder(testOrder.order_id, 'archived_in_shopify');
    
    if (!archiveResult.success) {
      throw new Error('Failed to archive test order: ' + archiveResult.error);
    }

    // Verify status is preserved
    const archivedOrder = archiveResult.order;
    
    if (archivedOrder.status !== originalStatus) {
      throw new Error(`Status changed from '${originalStatus}' to '${archivedOrder.status}' when archiving`);
    }

    if (!archivedOrder.archived_at) {
      throw new Error('Order not marked as archived');
    }

    results.push({ 
      test: 3, 
      name: 'Archive Test Order - Preserve Status', 
      status: '✅ PASS', 
      details: `Status preserved: ${originalStatus}, Archived: ${!!archivedOrder.archived_at}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 3, name: 'Archive Test Order - Preserve Status', status: '❌ FAIL', error: error.message });
  }

  // Test 4: Create another test order for cancellation
  try {
    const testOrderId = '#TEST-CANCEL-' + Date.now();
    
    // Create a test order
    const { data: testOrder, error } = await supabase
      .from('orders')
      .insert({
        fid: 99999,
        order_id: testOrderId,
        status: 'paid',
        currency: 'USDC',
        amount_total: 30.00,
        line_items: [{ id: 'test', title: 'Test Product', quantity: 1, price: 30.00 }],
        payment_method: 'USDC',
        payment_status: 'completed'
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create test order: ' + error.message);
    }

    results.push({ 
      test: 4, 
      name: 'Create Test Order for Cancellation', 
      status: '✅ PASS', 
      details: `Created order ${testOrderId} with status: ${testOrder.status}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 4, name: 'Create Test Order for Cancellation', status: '❌ FAIL', error: error.message });
  }

  // Test 5: Cancel the test order and verify status is set to cancelled
  try {
    // Get the test order ID from the previous test
    const { data: orders } = await supabase
      .from('orders')
      .select('order_id, status')
      .eq('fid', 99999)
      .like('order_id', '#TEST-CANCEL-%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!orders || orders.length === 0) {
      throw new Error('Test order not found');
    }

    const testOrder = orders[0];

    // Cancel the order
    const cancelResult = await cancelOrder(testOrder.order_id, 'cancelled_in_shopify');
    
    if (!cancelResult.success) {
      throw new Error('Failed to cancel test order: ' + cancelResult.error);
    }

    // Verify status is set to cancelled
    const cancelledOrder = cancelResult.order;
    
    if (cancelledOrder.status !== 'cancelled') {
      throw new Error(`Expected status 'cancelled', got '${cancelledOrder.status}'`);
    }

    if (!cancelledOrder.archived_at) {
      throw new Error('Cancelled order not marked as archived');
    }

    results.push({ 
      test: 5, 
      name: 'Cancel Test Order - Set Status to Cancelled', 
      status: '✅ PASS', 
      details: `Status: ${cancelledOrder.status}, Archived: ${!!cancelledOrder.archived_at}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 5, name: 'Cancel Test Order - Set Status to Cancelled', status: '❌ FAIL', error: error.message });
  }

  // Test 6: Clean up test orders
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('fid', 99999);

    if (error) {
      throw new Error('Failed to clean up test orders: ' + error.message);
    }

    results.push({ 
      test: 6, 
      name: 'Clean Up Test Orders', 
      status: '✅ PASS', 
      details: 'Test orders removed successfully' 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 6, name: 'Clean Up Test Orders', status: '❌ FAIL', error: error.message });
  }

  const successRate = (successCount / totalTests * 100).toFixed(1);

  return NextResponse.json({
    success: true,
    message: 'Order status handling test completed',
    results: {
      timestamp: new Date().toISOString(),
      tests: results,
      summary: {
        passed: successCount,
        failed: totalTests - successCount,
        total: totalTests,
        successRate: `${successRate}%`
      },
      explanation: {
        archiving: 'When orders are archived (fulfilled then archived for record-keeping), the original status (shipped, delivered, etc.) is preserved',
        cancelling: 'When orders are cancelled, the status is set to "cancelled" and the order is also archived',
        correctBehavior: 'Order #1189 should show status "shipped" with archived_at and archived_in_shopify set to true'
      }
    }
  });
} 