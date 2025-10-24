import { NextResponse } from 'next/server';
import { 
  validateDiscountForOrder, 
  createOrder, 
  checkDiscountUsageConflict,
  getDiscountUsageStats,
  hasUserUsedDiscounts
} from '@/lib/orders';
import { 
  createWelcomeDiscountCode, 
  validateDiscountCode, 
  calculateDiscountAmount,
  markDiscountCodeAsUsed 
} from '@/lib/discounts';
import { supabase } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export async function GET() {
  const results = [];
  let successCount = 0;
  const totalTests = 12;

  // Test 1: Database Connection
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    results.push({ test: 1, name: 'Database Connection', status: '✅ PASS', details: 'Successfully connected to Supabase' });
    successCount++;
  } catch (error) {
    results.push({ test: 1, name: 'Database Connection', status: '❌ FAIL', error: error.message });
  }

  // Test 2: Create Test Profile and Discount Code
  const testFid = 99999;
  let testDiscountCode = null;
  try {
    // Clean up any existing test data
    await supabase.from('orders').delete().eq('fid', testFid);
    await supabase.from('discount_codes').delete().eq('fid', testFid);
    await supabase.from('profiles').delete().eq('fid', testFid);

    // Create test profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ fid: testFid, username: 'testuser99999', display_name: 'Test User' });
    
    if (profileError) throw profileError;

    // Create welcome discount code
    const discountResult = await createWelcomeDiscountCode(testFid);
    if (!discountResult.success) throw new Error(discountResult.error);
    
    testDiscountCode = discountResult.code;
    results.push({ 
      test: 2, 
      name: 'Create Test Profile and Discount Code', 
      status: '✅ PASS', 
      details: `Created profile and discount code: ${testDiscountCode}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 2, name: 'Create Test Profile and Discount Code', status: '❌ FAIL', error: error.message });
  }

  // Test 3: Validate Discount Code for Order Processing
  try {
    if (!testDiscountCode) throw new Error('No test discount code available');
    
    const validationResult = await validateDiscountForOrder(testDiscountCode, testFid, 150.00);
    
    if (!validationResult.success || !validationResult.isValid) {
      throw new Error(validationResult.error || 'Validation failed');
    }
    
    results.push({ 
      test: 3, 
      name: 'Validate Discount Code for Order Processing', 
      status: '✅ PASS', 
      details: `Code ${testDiscountCode} is valid for order processing` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 3, name: 'Validate Discount Code for Order Processing', status: '❌ FAIL', error: error.message });
  }

  // Test 4: Check No Usage Conflicts (Initial State)
  try {
    if (!testDiscountCode) throw new Error('No test discount code available');
    
    const conflictResult = await checkDiscountUsageConflict(testDiscountCode);
    
    if (!conflictResult.success) {
      throw new Error(conflictResult.error);
    }
    
    if (conflictResult.hasConflict) {
      throw new Error(`Unexpected conflict detected: ${JSON.stringify(conflictResult.conflictingOrders)}`);
    }
    
    results.push({ 
      test: 4, 
      name: 'Check No Usage Conflicts (Initial State)', 
      status: '✅ PASS', 
      details: 'No conflicts detected for unused discount code' 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 4, name: 'Check No Usage Conflicts (Initial State)', status: '❌ FAIL', error: error.message });
  }

  // Test 5: Create Order with Discount Code
  let testOrderId = null;
  try {
    if (!testDiscountCode) throw new Error('No test discount code available');
    
    testOrderId = `ORDER_TEST_${Date.now()}`;
    const orderData = {
      fid: testFid,
      orderId: testOrderId,
      sessionId: `SESSION_${Date.now()}`,
      status: 'pending',
      currency: 'USDC',
      amountTotal: 162.50, // $150 - $22.50 + $10 + $25 (subtotal - discount + shipping + tax)
      amountSubtotal: 150.00,
      amountTax: 25.00,
      amountShipping: 10.00,
      discountCode: testDiscountCode,
      discountAmount: 22.50, // 15% of $150
      discountPercentage: 15.00,
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      lineItems: [{ product_id: 'test_product', quantity: 1, price: 150.00 }],
      paymentMethod: 'USDC',
      paymentStatus: 'pending'
    };
    
    const orderResult = await createOrder(orderData);
    
    if (!orderResult.success) {
      throw new Error(orderResult.error);
    }
    
    results.push({ 
      test: 5, 
      name: 'Create Order with Discount Code', 
      status: '✅ PASS', 
      details: `Order ${testOrderId} created with discount ${testDiscountCode}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 5, name: 'Create Order with Discount Code', status: '❌ FAIL', error: error.message });
  }

  // Test 6: Verify Discount Code Marked as Used
  try {
    if (!testDiscountCode) throw new Error('No test discount code available');
    
    const { data: discountData, error } = await supabase
      .from('discount_codes')
      .select('is_used, used_at, order_id')
      .eq('code', testDiscountCode.toUpperCase())
      .single();
    
    if (error) throw error;
    
    if (!discountData.is_used) {
      throw new Error('Discount code was not marked as used');
    }
    
    if (discountData.order_id !== testOrderId) {
      throw new Error(`Order ID mismatch: expected ${testOrderId}, got ${discountData.order_id}`);
    }
    
    results.push({ 
      test: 6, 
      name: 'Verify Discount Code Marked as Used', 
      status: '✅ PASS', 
      details: `Discount code marked as used for order ${testOrderId}` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 6, name: 'Verify Discount Code Marked as Used', status: '❌ FAIL', error: error.message });
  }

  // Test 7: Prevent Duplicate Usage (Usage Conflict Detection)
  try {
    if (!testDiscountCode) throw new Error('No test discount code available');
    
    const conflictResult = await checkDiscountUsageConflict(testDiscountCode);
    
    if (!conflictResult.success) {
      throw new Error(conflictResult.error);
    }
    
    if (!conflictResult.hasConflict) {
      throw new Error('Expected usage conflict to be detected');
    }
    
    if (conflictResult.conflictingOrders.length === 0) {
      throw new Error('Expected conflicting orders to be found');
    }
    
    results.push({ 
      test: 7, 
      name: 'Prevent Duplicate Usage (Usage Conflict Detection)', 
      status: '✅ PASS', 
      details: `Conflict detected: ${conflictResult.conflictingOrders.length} conflicting order(s)` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 7, name: 'Prevent Duplicate Usage (Usage Conflict Detection)', status: '❌ FAIL', error: error.message });
  }

  // Test 8: Validate Used Discount Code (Should Fail)
  try {
    if (!testDiscountCode) throw new Error('No test discount code available');
    
    const validationResult = await validateDiscountCode(testDiscountCode, testFid);
    
    if (validationResult.success && validationResult.isValid) {
      throw new Error('Used discount code should not validate as available');
    }
    
    if (!validationResult.error || !validationResult.error.includes('already been used')) {
      throw new Error(`Unexpected error message: ${validationResult.error}`);
    }
    
    results.push({ 
      test: 8, 
      name: 'Validate Used Discount Code (Should Fail)', 
      status: '✅ PASS', 
      details: 'Used discount code correctly rejected' 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 8, name: 'Validate Used Discount Code (Should Fail)', status: '❌ FAIL', error: error.message });
  }

  // Test 9: Get Discount Usage Statistics
  try {
    const statsResult = await getDiscountUsageStats(testFid);
    
    if (!statsResult.success) {
      throw new Error(statsResult.error);
    }
    
    const stats = statsResult.stats;
    
    if (stats.totalOrdersWithDiscounts < 1) {
      throw new Error('Expected at least 1 order with discount');
    }
    
    if (stats.totalDiscountAmount < 20) {
      throw new Error(`Expected discount amount >= $20, got $${stats.totalDiscountAmount}`);
    }
    
    results.push({ 
      test: 9, 
      name: 'Get Discount Usage Statistics', 
      status: '✅ PASS', 
      details: `Found ${stats.totalOrdersWithDiscounts} orders with $${stats.totalDiscountAmount.toFixed(2)} total discount` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 9, name: 'Get Discount Usage Statistics', status: '❌ FAIL', error: error.message });
  }

  // Test 10: Check User Has Used Discounts
  try {
    const usageResult = await hasUserUsedDiscounts(testFid);
    
    if (!usageResult.success) {
      throw new Error(usageResult.error);
    }
    
    if (!usageResult.hasUsedDiscounts) {
      throw new Error('Expected user to have used discounts');
    }
    
    if (usageResult.discountOrdersCount < 1) {
      throw new Error(`Expected at least 1 discount order, got ${usageResult.discountOrdersCount}`);
    }
    
    results.push({ 
      test: 10, 
      name: 'Check User Has Used Discounts', 
      status: '✅ PASS', 
      details: `User has used discounts in ${usageResult.discountOrdersCount} order(s)` 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 10, name: 'Check User Has Used Discounts', status: '❌ FAIL', error: error.message });
  }

  // Test 11: Attempt to Create Second Order with Same Code (Should Fail)
  try {
    if (!testDiscountCode) throw new Error('No test discount code available');
    
    const secondOrderId = `ORDER_TEST_SECOND_${Date.now()}`;
    const orderData = {
      fid: testFid,
      orderId: secondOrderId,
      sessionId: `SESSION_SECOND_${Date.now()}`,
      status: 'pending',
      currency: 'USDC',
      amountTotal: 162.50,
      amountSubtotal: 150.00,
      amountTax: 25.00,
      amountShipping: 10.00,
      discountCode: testDiscountCode,
      discountAmount: 22.50,
      discountPercentage: 15.00,
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      lineItems: [{ product_id: 'test_product', quantity: 1, price: 150.00 }],
      paymentMethod: 'USDC',
      paymentStatus: 'pending'
    };
    
    const orderResult = await createOrder(orderData);
    
    if (orderResult.success) {
      throw new Error('Second order with same discount code should have failed');
    }
    
    if (!orderResult.error || !orderResult.error.includes('already been used')) {
      throw new Error(`Expected 'already been used' error, got: ${orderResult.error}`);
    }
    
    results.push({ 
      test: 11, 
      name: 'Attempt to Create Second Order with Same Code (Should Fail)', 
      status: '✅ PASS', 
      details: 'Second order correctly rejected due to used discount code' 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 11, name: 'Attempt to Create Second Order with Same Code (Should Fail)', status: '❌ FAIL', error: error.message });
  }

  // Test 12: Verify Order Data Integrity
  try {
    if (!testOrderId) throw new Error('No test order ID available');
    
    const { data: orderData, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', testOrderId)
      .single();
    
    if (error) throw error;
    
    if (!orderData.discount_code || orderData.discount_code !== testDiscountCode) {
      throw new Error(`Discount code mismatch: expected ${testDiscountCode}, got ${orderData.discount_code}`);
    }
    
    if (parseFloat(orderData.discount_amount) !== 22.50) {
      throw new Error(`Discount amount mismatch: expected 22.50, got ${orderData.discount_amount}`);
    }
    
    if (parseFloat(orderData.discount_percentage) !== 15.00) {
      throw new Error(`Discount percentage mismatch: expected 15.00, got ${orderData.discount_percentage}`);
    }
    
    results.push({ 
      test: 12, 
      name: 'Verify Order Data Integrity', 
      status: '✅ PASS', 
      details: 'Order data correctly stored with discount information' 
    });
    successCount++;
  } catch (error) {
    results.push({ test: 12, name: 'Verify Order Data Integrity', status: '❌ FAIL', error: error.message });
  }

  // Clean up test data
  try {
    await supabase.from('orders').delete().eq('fid', testFid);
    await supabase.from('discount_codes').delete().eq('fid', testFid);
    await supabase.from('profiles').delete().eq('fid', testFid);
  } catch (error) {
    console.log('Cleanup error (non-critical):', error.message);
  }

  const successRate = (successCount / totalTests * 100).toFixed(1);
  
  return NextResponse.json({
    title: 'Phase 4: Order Processing & Usage Tracking Tests',
    summary: `${successCount}/${totalTests} tests passed (${successRate}%)`,
    success: successCount === totalTests,
    results,
    timestamp: new Date().toISOString(),
    phase: 'Phase 4: Order Processing & Usage Tracking',
    features_tested: [
      'Discount code validation for order processing',
      'Usage conflict detection and prevention',
      'Order creation with discount tracking',
      'Automatic discount code marking as used',
      'Duplicate usage prevention',
      'Discount usage statistics',
      'Order data integrity verification'
    ]
  });
} 