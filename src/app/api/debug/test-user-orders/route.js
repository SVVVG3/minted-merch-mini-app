import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    console.log('🧪 Testing user orders API endpoint...');

    // Test FID (svvvg3.eth's FID)
    const testFid = 466111;
    
    // Call our new API endpoint
    const apiUrl = `${request.nextUrl.origin}/api/user-orders?fid=${testFid}&limit=10`;
    console.log('📞 Calling API:', apiUrl);
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log('📊 API Response Status:', response.status);
    console.log('📊 API Response Data:', JSON.stringify(data, null, 2));
    
    // Test results
    const testResults = {
      apiEndpoint: '/api/user-orders',
      testFid,
      responseStatus: response.status,
      responseOk: response.ok,
      hasOrders: data.orders && data.orders.length > 0,
      orderCount: data.orders ? data.orders.length : 0,
      statsIncluded: !!data.stats,
      sampleOrder: data.orders && data.orders.length > 0 ? {
        orderId: data.orders[0].orderId,
        status: data.orders[0].status,
        total: data.orders[0].total?.amount,
        currency: data.orders[0].total?.currencyCode,
        lineItems: data.orders[0].lineItems?.length || 0,
        hasTransactionHash: !!data.orders[0].transactionHash,
        hasDiscountCode: !!data.orders[0].discountCode
      } : null,
      stats: data.stats,
      apiResponse: data
    };

    return NextResponse.json({
      success: true,
      message: '✅ User orders API test completed',
      testResults,
      recommendations: [
        response.ok ? '✅ API endpoint working correctly' : '❌ API endpoint returned error',
        data.orders && data.orders.length > 0 ? '✅ Orders retrieved successfully' : '⚠️ No orders found for test FID',
        data.stats ? '✅ Statistics calculated correctly' : '❌ Statistics missing',
        testResults.sampleOrder ? '✅ Order data structure looks good' : '⚠️ No sample order to verify'
      ]
    });

  } catch (error) {
    console.error('❌ Error testing user orders API:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      message: '❌ User orders API test failed',
      details: 'Check server logs for more information'
    }, { status: 500 });
  }
});