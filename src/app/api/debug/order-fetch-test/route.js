import { getOrder } from '@/lib/orders';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber') || '1193';
    
    console.log('Testing order fetch for:', orderNumber);
    
    // Test both formats
    const results = {};
    
    // Try with # prefix
    const withHash = `#${orderNumber}`;
    const result1 = await getOrder(withHash);
    results[`with_hash_${withHash}`] = {
      success: result1.success,
      found: !!result1.order,
      order_id: result1.order?.order_id,
      amount_total: result1.order?.amount_total,
      line_items_count: result1.order?.line_items?.length,
      error: result1.error
    };
    
    // Try without # prefix
    const result2 = await getOrder(orderNumber);
    results[`without_hash_${orderNumber}`] = {
      success: result2.success,
      found: !!result2.order,
      order_id: result2.order?.order_id,
      amount_total: result2.order?.amount_total,
      line_items_count: result2.order?.line_items?.length,
      error: result2.error
    };
    
    // If orderNumber already has #, try it as-is
    if (orderNumber.startsWith('#')) {
      const result3 = await getOrder(orderNumber);
      results[`as_is_${orderNumber}`] = {
        success: result3.success,
        found: !!result3.order,
        order_id: result3.order?.order_id,
        amount_total: result3.order?.amount_total,
        line_items_count: result3.order?.line_items?.length,
        error: result3.error
      };
    }
    
    return Response.json({
      success: true,
      tested_order_number: orderNumber,
      results
    });
    
  } catch (error) {
    console.error('Error in order fetch test:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 