import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('order') || '1265';

    console.log(`🔍 Analyzing tax calculation for order #${orderNumber}`);

    // Fetch the order from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (orderError) {
      console.error('❌ Error fetching order:', orderError);
      return NextResponse.json({ error: 'Order not found', details: orderError }, { status: 404 });
    }

    console.log('📋 Order data from database:', {
      order_number: order.order_number,
      amount_total: order.amount_total,
      amount_subtotal: order.amount_subtotal,
      amount_tax: order.amount_tax,
      amount_shipping: order.amount_shipping,
      discount_code: order.discount_code,
      discount_amount: order.discount_amount,
      actual_payment_amount: order.actual_payment_amount,
      transaction_hash: order.transaction_hash
    });

    // Calculate what the tax SHOULD be with proper adjustment
    const originalSubtotal = order.amount_subtotal + (order.discount_amount || 0);
    const originalTax = order.amount_tax;
    const discountAmount = order.discount_amount || 0;
    const shippingAmount = order.amount_shipping || 0;

    console.log('🧮 Recalculating with correct logic...');
    
    // Calculate tax rate from original values
    const taxRate = originalSubtotal > 0 ? originalTax / originalSubtotal : 0;
    
    // Apply tax rate to discounted subtotal
    const discountedSubtotal = originalSubtotal - discountAmount;
    const adjustedTax = discountedSubtotal > 0 ? discountedSubtotal * taxRate : 0;
    
    // Calculate correct total
    const correctTotal = discountedSubtotal + adjustedTax + shippingAmount;

    const analysis = {
      orderNumber: order.order_number,
      databaseValues: {
        subtotal: order.amount_subtotal,
        tax: order.amount_tax,
        shipping: order.amount_shipping,
        discount: order.discount_amount,
        total: order.amount_total,
        actualPayment: order.actual_payment_amount
      },
      calculatedValues: {
        originalSubtotal: originalSubtotal,
        taxRate: (taxRate * 100).toFixed(4) + '%',
        discountedSubtotal: discountedSubtotal,
        adjustedTax: adjustedTax,
        correctTotal: correctTotal
      },
      discrepancy: {
        taxDifference: originalTax - adjustedTax,
        totalDifference: order.amount_total - correctTotal,
        actualPaymentDifference: order.amount_total - (order.actual_payment_amount || 0)
      },
      issue: {
        description: 'Tax calculated on pre-discount amount instead of post-discount amount',
        usingPreDiscountTax: originalTax,
        shouldUsePostDiscountTax: adjustedTax,
        overchargedBy: originalTax - adjustedTax
      }
    };

    console.log('📊 Tax calculation analysis:', analysis);

    // Also check other recent orders with discounts
    const { data: discountOrders, error: discountError } = await supabase
      .from('orders')
      .select('order_number, amount_total, amount_subtotal, amount_tax, discount_amount, actual_payment_amount')
      .not('discount_code', 'is', null)
      .not('discount_amount', 'is', null)
      .gt('discount_amount', 0)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!discountError && discountOrders) {
      const batchAnalysis = discountOrders.map(order => {
        const originalSubtotal = order.amount_subtotal + (order.discount_amount || 0);
        const originalTax = order.amount_tax;
        const discountAmount = order.discount_amount || 0;
        
        const taxRate = originalSubtotal > 0 ? originalTax / originalSubtotal : 0;
        const discountedSubtotal = originalSubtotal - discountAmount;
        const adjustedTax = discountedSubtotal > 0 ? discountedSubtotal * taxRate : 0;
        
        return {
          order_number: order.order_number,
          recorded_tax: originalTax,
          correct_tax: adjustedTax,
          tax_overcharge: originalTax - adjustedTax,
          recorded_total: order.amount_total,
          actual_payment: order.actual_payment_amount,
          payment_discrepancy: order.amount_total - (order.actual_payment_amount || 0)
        };
      });

      analysis.batchAnalysis = batchAnalysis;
      
      const totalOvercharge = batchAnalysis.reduce((sum, order) => sum + order.tax_overcharge, 0);
      analysis.summary = {
        ordersAnalyzed: batchAnalysis.length,
        totalTaxOvercharge: totalOvercharge,
        averageTaxOvercharge: totalOvercharge / batchAnalysis.length
      };
    }

    return NextResponse.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('❌ Error in tax calculation analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze tax calculation', 
      details: error.message 
    }, { status: 500 });
  }
} 