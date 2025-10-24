import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours')) || 24;
    
    console.log(`🔍 ANALYSIS: Starting order failure analysis for last ${hours} hours`);
    
    const analysis = {
      timestamp: new Date().toISOString(),
      timeframe: `${hours} hours`,
      findings: {},
      recommendations: [],
      potentialIssues: []
    };

    // 1. Check recent order creation patterns in Supabase
    try {
      const recentOrders = await analyzeRecentOrders(hours);
      analysis.findings.supabaseOrders = recentOrders;
    } catch (error) {
      analysis.findings.supabaseOrders = { error: error.message };
    }

    // 2. Check for missing Shopify orders (orders that should exist but don't)
    try {
      const missingShopifyOrders = await checkMissingShopifyOrders();
      analysis.findings.missingShopifyOrders = missingShopifyOrders;
    } catch (error) {
      analysis.findings.missingShopifyOrders = { error: error.message };
    }

    // 3. Analyze discount usage patterns
    try {
      const discountAnalysis = await analyzeDiscountPatterns(hours);
      analysis.findings.discountPatterns = discountAnalysis;
    } catch (error) {
      analysis.findings.discountPatterns = { error: error.message };
    }

    // 4. Check for data structure issues
    try {
      const dataStructureIssues = await analyzeDataStructureIssues();
      analysis.findings.dataStructureIssues = dataStructureIssues;
    } catch (error) {
      analysis.findings.dataStructureIssues = { error: error.message };
    }

    // 5. Generate recommendations based on findings
    analysis.recommendations = generateFailureRecommendations(analysis.findings);
    analysis.potentialIssues = identifyPotentialIssues(analysis.findings);

    console.log('🔍 ANALYSIS: Analysis complete:', analysis.recommendations);
    
    return NextResponse.json(analysis);
    
  } catch (error) {
    console.error('❌ ANALYSIS: Error in failure analysis:', error);
    return NextResponse.json({
      error: 'Analysis failed',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

async function analyzeRecentOrders(hours) {
  const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  // Get recent orders from Supabase
  const { supabase } = await import('@/lib/supabase');
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', hoursAgo)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  const analysis = {
    totalOrders: orders.length,
    ordersByStatus: {},
    ordersByPaymentStatus: {},
    averageAmount: 0,
    discountUsage: {
      withDiscount: 0,
      withoutDiscount: 0,
      discountCodes: {}
    },
    recentOrderIds: orders.slice(0, 10).map(o => o.order_id),
    timePattern: {}
  };

  // Analyze patterns
  orders.forEach(order => {
    // Status distribution
    analysis.ordersByStatus[order.status] = (analysis.ordersByStatus[order.status] || 0) + 1;
    analysis.ordersByPaymentStatus[order.payment_status] = (analysis.ordersByPaymentStatus[order.payment_status] || 0) + 1;
    
    // Discount usage
    if (order.discount_code) {
      analysis.discountUsage.withDiscount++;
      analysis.discountUsage.discountCodes[order.discount_code] = 
        (analysis.discountUsage.discountCodes[order.discount_code] || 0) + 1;
    } else {
      analysis.discountUsage.withoutDiscount++;
    }
    
    // Time pattern (by hour)
    const hour = new Date(order.created_at).getHours();
    analysis.timePattern[hour] = (analysis.timePattern[hour] || 0) + 1;
  });

  // Calculate average amount
  if (orders.length > 0) {
    analysis.averageAmount = orders.reduce((sum, order) => sum + parseFloat(order.amount_total || 0), 0) / orders.length;
  }

  return analysis;
}

async function checkMissingShopifyOrders() {
  // This would require checking Shopify API vs our database
  // For now, we'll identify orders with payment_status 'completed' but status 'pending'
  
  const { supabase } = await import('@/lib/supabase');
  
  const { data: suspiciousOrders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_status', 'completed')
    .neq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  return {
    potentialMissing: suspiciousOrders.length,
    examples: suspiciousOrders.slice(0, 5).map(order => ({
      orderId: order.order_id,
      status: order.status,
      paymentStatus: order.payment_status,
      amount: order.amount_total,
      createdAt: order.created_at
    }))
  };
}

async function analyzeDiscountPatterns(hours) {
  const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  const { supabase } = await import('@/lib/supabase');
  
  // Get orders with discounts
  const { data: discountOrders, error } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', hoursAgo)
    .not('discount_code', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  const analysis = {
    totalWithDiscounts: discountOrders.length,
    discountBreakdown: {},
    averageDiscountAmount: 0,
    suspiciousDiscounts: []
  };

  discountOrders.forEach(order => {
    const code = order.discount_code;
    if (!analysis.discountBreakdown[code]) {
      analysis.discountBreakdown[code] = {
        usage: 0,
        totalSaved: 0,
        averageOrderValue: 0,
        orderValues: []
      };
    }
    
    analysis.discountBreakdown[code].usage++;
    analysis.discountBreakdown[code].totalSaved += parseFloat(order.discount_amount || 0);
    analysis.discountBreakdown[code].orderValues.push(parseFloat(order.amount_total || 0));
    
    // Flag suspicious patterns
    if (parseFloat(order.discount_amount || 0) > parseFloat(order.amount_subtotal || 0)) {
      analysis.suspiciousDiscounts.push({
        orderId: order.order_id,
        discountCode: code,
        discountAmount: order.discount_amount,
        subtotal: order.amount_subtotal,
        issue: 'discount_exceeds_subtotal'
      });
    }
  });

  // Calculate averages
  Object.keys(analysis.discountBreakdown).forEach(code => {
    const breakdown = analysis.discountBreakdown[code];
    breakdown.averageOrderValue = breakdown.orderValues.reduce((a, b) => a + b, 0) / breakdown.orderValues.length;
  });

  if (discountOrders.length > 0) {
    analysis.averageDiscountAmount = discountOrders.reduce((sum, order) => sum + parseFloat(order.discount_amount || 0), 0) / discountOrders.length;
  }

  return analysis;
}

async function analyzeDataStructureIssues() {
  const { supabase } = await import('@/lib/supabase');
  
  // Check for common data issues
  const issues = {
    ordersWithMissingData: [],
    ordersWithInvalidAmounts: [],
    ordersWithMissingLineItems: [],
    ordersWithInvalidPaymentData: []
  };

  // Get recent orders that might have issues
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  orders.forEach(order => {
    // Missing essential data
    if (!order.customer_email || !order.shipping_address) {
      issues.ordersWithMissingData.push({
        orderId: order.order_id,
        missingFields: [
          !order.customer_email ? 'customer_email' : null,
          !order.shipping_address ? 'shipping_address' : null
        ].filter(Boolean)
      });
    }

    // Invalid amounts
    if (parseFloat(order.amount_total || 0) <= 0 || 
        parseFloat(order.amount_subtotal || 0) <= 0) {
      issues.ordersWithInvalidAmounts.push({
        orderId: order.order_id,
        amountTotal: order.amount_total,
        amountSubtotal: order.amount_subtotal
      });
    }

    // Missing line items
    if (!order.line_items || (Array.isArray(order.line_items) && order.line_items.length === 0)) {
      issues.ordersWithMissingLineItems.push({
        orderId: order.order_id,
        lineItems: order.line_items
      });
    }

    // Invalid payment data
    if (!order.payment_intent_id || order.payment_status === 'completed' && order.status === 'pending') {
      issues.ordersWithInvalidPaymentData.push({
        orderId: order.order_id,
        paymentIntentId: order.payment_intent_id,
        paymentStatus: order.payment_status,
        status: order.status
      });
    }
  });

  return {
    totalOrdersChecked: orders.length,
    issuesSummary: {
      missingData: issues.ordersWithMissingData.length,
      invalidAmounts: issues.ordersWithInvalidAmounts.length,
      missingLineItems: issues.ordersWithMissingLineItems.length,
      invalidPaymentData: issues.ordersWithInvalidPaymentData.length
    },
    detailedIssues: issues
  };
}

function generateFailureRecommendations(findings) {
  const recommendations = [];

  // Based on Supabase analysis
  if (findings.supabaseOrders && !findings.supabaseOrders.error) {
    const analysis = findings.supabaseOrders;
    
    if (analysis.totalOrders === 0) {
      recommendations.push('🚨 CRITICAL: No orders found in database - check order creation pipeline');
    }
    
    if (analysis.ordersByPaymentStatus?.completed && analysis.ordersByStatus?.pending) {
      recommendations.push('⚠️ Found completed payments with pending orders - investigate Shopify integration');
    }
    
    if (analysis.discountUsage.withDiscount > analysis.discountUsage.withoutDiscount * 2) {
      recommendations.push('📊 High discount usage - verify discount validation logic');
    }
  }

  // Based on missing Shopify orders
  if (findings.missingShopifyOrders && findings.missingShopifyOrders.potentialMissing > 0) {
    recommendations.push(`🔍 Found ${findings.missingShopifyOrders.potentialMissing} orders that may not exist in Shopify`);
  }

  // Based on discount analysis
  if (findings.discountPatterns && findings.discountPatterns.suspiciousDiscounts?.length > 0) {
    recommendations.push('💰 Found discount calculation issues - check discount amount logic');
  }

  // Based on data structure issues
  if (findings.dataStructureIssues && !findings.dataStructureIssues.error) {
    const issues = findings.dataStructureIssues.issuesSummary;
    
    if (issues.missingData > 0) {
      recommendations.push(`📝 ${issues.missingData} orders missing essential data`);
    }
    
    if (issues.invalidAmounts > 0) {
      recommendations.push(`💵 ${issues.invalidAmounts} orders with invalid amounts`);
    }
    
    if (issues.missingLineItems > 0) {
      recommendations.push(`🛒 ${issues.missingLineItems} orders missing line items`);
    }
    
    if (issues.invalidPaymentData > 0) {
      recommendations.push(`💳 ${issues.invalidPaymentData} orders with payment data issues`);
    }
  }

  return recommendations;
}

function identifyPotentialIssues(findings) {
  const issues = [];

  // API timeout issues
  if (findings.supabaseOrders?.error?.includes('timeout')) {
    issues.push({
      type: 'API_TIMEOUT',
      description: 'Database queries timing out',
      severity: 'HIGH',
      solution: 'Check database performance and connection pooling'
    });
  }

  // Data validation issues
  if (findings.dataStructureIssues?.issuesSummary?.missingData > 0) {
    issues.push({
      type: 'DATA_VALIDATION',
      description: 'Orders missing required fields',
      severity: 'HIGH',
      solution: 'Add stricter validation before order creation'
    });
  }

  // Discount calculation issues
  if (findings.discountPatterns?.suspiciousDiscounts?.length > 0) {
    issues.push({
      type: 'DISCOUNT_CALCULATION',
      description: 'Discount amounts exceeding subtotals',
      severity: 'MEDIUM',
      solution: 'Fix discount calculation logic and add validation'
    });
  }

  // Shopify integration issues
  if (findings.missingShopifyOrders?.potentialMissing > 0) {
    issues.push({
      type: 'SHOPIFY_INTEGRATION',
      description: 'Orders not properly created in Shopify',
      severity: 'HIGH',
      solution: 'Investigate Shopify Admin API calls and error handling'
    });
  }

  return issues;
}

export const POST = withAdminAuth(async (request, context) => {
  const body = await request.json();
  const { action, orderIds } = body;
  
  if (action === 'reprocess_failed_orders' && orderIds) {
    return await reprocessFailedOrders(orderIds);
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});

async function reprocessFailedOrders(orderIds) {
  // This would attempt to recreate failed orders
  // Implementation would depend on having the original order data
  
  return NextResponse.json({
    message: 'Reprocessing not yet implemented',
    orderIds,
    note: 'This would attempt to recreate failed orders in Shopify'
  });
} 