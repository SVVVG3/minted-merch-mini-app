import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  console.log('🐛 Debug: Testing admin orders API...');
  
  const result = {
    timestamp: new Date().toISOString(),
    step1_supabase_admin_check: {},
    step2_orders_table_test: {},
    step3_order_items_test: {},
    step4_full_query_test: {}
  };

  try {
    // Step 1: Check if supabaseAdmin is working
    console.log('Step 1: Testing supabaseAdmin connection...');
    const { data: adminTest, error: adminTestError } = await supabaseAdmin
      .from('profiles')
      .select('count')
      .limit(1);
    
    result.step1_supabase_admin_check = {
      success: !adminTestError,
      error: adminTestError?.message,
      canConnect: !!adminTest
    };

    // Step 2: Test orders table access
    console.log('Step 2: Testing orders table access...');
    const { data: ordersTest, error: ordersTestError } = await supabaseAdmin
      .from('orders')
      .select('order_id, fid, status, created_at')
      .limit(5);
    
    result.step2_orders_table_test = {
      success: !ordersTestError,
      error: ordersTestError?.message,
      orderCount: ordersTest?.length || 0,
      sampleOrders: ordersTest?.map(o => ({
        order_id: o.order_id,
        fid: o.fid,
        status: o.status,
        created_at: o.created_at
      })) || []
    };

    // Step 3: Test order_items table access
    console.log('Step 3: Testing order_items table access...');
    const { data: itemsTest, error: itemsTestError } = await supabaseAdmin
      .from('order_items')
      .select('id, order_id, product_title, quantity')
      .limit(5);
    
    result.step3_order_items_test = {
      success: !itemsTestError,
      error: itemsTestError?.message,
      itemCount: itemsTest?.length || 0,
      sampleItems: itemsTest?.map(i => ({
        id: i.id,
        order_id: i.order_id,
        product_title: i.product_title,
        quantity: i.quantity
      })) || []
    };

    // Step 4: Test the full join query
    console.log('Step 4: Testing full join query...');
    const { data: fullTest, error: fullTestError } = await supabaseAdmin
      .from('orders')
      .select(`
        order_id,
        fid,
        status,
        created_at,
        order_items (
          id,
          product_id,
          quantity,
          price_per_item,
          product_title
        )
      `)
      .limit(3);
    
    result.step4_full_query_test = {
      success: !fullTestError,
      error: fullTestError?.message,
      orderCount: fullTest?.length || 0,
      sampleWithItems: fullTest?.map(o => ({
        order_id: o.order_id,
        fid: o.fid,
        status: o.status,
        item_count: o.order_items?.length || 0,
        first_item: o.order_items?.[0]?.product_title || null
      })) || []
    };

    console.log('✅ Debug complete, returning results...');
    return NextResponse.json({
      success: true,
      debug_results: result
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    result.fatal_error = {
      message: error.message,
      stack: error.stack
    };
    
    return NextResponse.json({
      success: false,
      debug_results: result,
      error: error.message
    }, { status: 500 });
  }
});