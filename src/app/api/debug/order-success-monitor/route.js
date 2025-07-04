import { supabase } from '@/lib/supabase';
import { getOrdersByDateRange } from '@/lib/shopifyAdmin';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    console.log('🔍 Order success monitor check starting...');
    
    // Get date range for last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const dateRange = {
      start: yesterday.toISOString(),
      end: now.toISOString()
    };
    
    console.log('📊 Checking orders from:', dateRange);
    
    // Get recent orders from Supabase (last 24 hours)
    const { data: supabaseOrders, error: supabaseError } = await supabase
      .from('orders')
      .select('order_id, status, created_at, amount_total, customer_email, discount_code')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false });
    
    if (supabaseError) {
      console.error('❌ Error fetching Supabase orders:', supabaseError);
      throw new Error(`Supabase query failed: ${supabaseError.message}`);
    }
    
    console.log(`📦 Found ${supabaseOrders?.length || 0} orders in Supabase`);
    
    // Try to get recent orders from Shopify for comparison
    let shopifyOrders = [];
    try {
      // Note: This would require implementing getOrdersByDateRange in shopifyAdmin.js
      // For now, we'll focus on Supabase monitoring
      console.log('ℹ️ Shopify order comparison not yet implemented');
    } catch (shopifyError) {
      console.warn('⚠️ Could not fetch Shopify orders for comparison:', shopifyError.message);
    }
    
    // Analyze order patterns
    const analysis = {
      timestamp: now.toISOString(),
      period: '24 hours',
      dateRange: dateRange,
      supabase: {
        totalOrders: supabaseOrders?.length || 0,
        ordersByStatus: {},
        discountedOrders: 0,
        totalValue: 0,
        averageValue: 0,
        recentOrders: []
      },
      shopify: {
        totalOrders: shopifyOrders.length,
        note: 'Shopify comparison not yet implemented'
      },
      healthScore: 'UNKNOWN'
    };
    
    // Analyze Supabase orders
    if (supabaseOrders && supabaseOrders.length > 0) {
      // Group by status
      supabaseOrders.forEach(order => {
        const status = order.status || 'unknown';
        analysis.supabase.ordersByStatus[status] = (analysis.supabase.ordersByStatus[status] || 0) + 1;
        
        if (order.discount_code) {
          analysis.supabase.discountedOrders++;
        }
        
        if (order.amount_total) {
          analysis.supabase.totalValue += parseFloat(order.amount_total);
        }
      });
      
      analysis.supabase.averageValue = analysis.supabase.totalValue / supabaseOrders.length;
      
      // Get recent orders for display
      analysis.supabase.recentOrders = supabaseOrders.slice(0, 10).map(order => ({
        orderId: order.order_id,
        status: order.status,
        createdAt: order.created_at,
        amountTotal: order.amount_total,
        customerEmail: order.customer_email?.substring(0, 3) + '***', // Privacy
        hasDiscount: !!order.discount_code,
        discountCode: order.discount_code
      }));
      
      // Calculate health score
      const confirmedOrders = analysis.supabase.ordersByStatus.confirmed || 0;
      const paidOrders = analysis.supabase.ordersByStatus.paid || 0;
      const successfulOrders = confirmedOrders + paidOrders;
      const successRate = analysis.supabase.totalOrders > 0 ? (successfulOrders / analysis.supabase.totalOrders) * 100 : 0;
      
      if (successRate >= 95) {
        analysis.healthScore = 'EXCELLENT';
      } else if (successRate >= 85) {
        analysis.healthScore = 'GOOD';
      } else if (successRate >= 70) {
        analysis.healthScore = 'WARNING';
      } else {
        analysis.healthScore = 'CRITICAL';
      }
      
      analysis.successRate = Math.round(successRate * 100) / 100;
    }
    
    // Alert conditions
    const alerts = [];
    
    if (analysis.supabase.totalOrders === 0) {
      alerts.push({
        level: 'WARNING',
        message: 'No orders found in last 24 hours'
      });
    }
    
    if (analysis.successRate < 85) {
      alerts.push({
        level: 'CRITICAL',
        message: `Low success rate: ${analysis.successRate}% (target: 95%+)`
      });
    }
    
    if (analysis.supabase.totalOrders > 0 && analysis.supabase.discountedOrders === 0) {
      alerts.push({
        level: 'INFO',
        message: 'No discounted orders in last 24 hours'
      });
    }
    
    analysis.alerts = alerts;
    
    console.log('✅ Order success monitor completed:', {
      totalOrders: analysis.supabase.totalOrders,
      successRate: analysis.successRate,
      healthScore: analysis.healthScore,
      alertCount: alerts.length
    });
    
    return NextResponse.json({
      success: true,
      analysis: analysis,
      debug: {
        supabaseOrderCount: supabaseOrders?.length || 0,
        shopifyOrderCount: shopifyOrders.length,
        monitoringActive: true
      }
    });
    
  } catch (error) {
    console.error('❌ Order success monitor failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Order monitoring failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 