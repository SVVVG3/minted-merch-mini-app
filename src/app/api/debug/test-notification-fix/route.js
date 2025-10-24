import { NextResponse } from 'next/server';
import { sendOrderConfirmationNotification } from '@/lib/neynar';
import { sendOrderConfirmationNotificationAndMark } from '@/lib/orders';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { fid, orderId } = await request.json();
    
    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID is required'
      }, { status: 400 });
    }
    
    console.log(`🧪 Testing notification fix for FID: ${fid}`);
    
    const results = {
      fid,
      orderId: orderId || 'test-order-123',
      tests: [],
      summary: { passed: 0, failed: 0 }
    };
    
    // Test 1: Direct notification function test
    try {
      const orderDetails = {
        orderId: orderId || 'test-order-123',
        amount: '71.98',
        currency: 'USDC',
        items: [
          { title: 'Bankr Hoodie', quantity: 1, price: 60.00 },
          { title: 'Dickbutt Cap', quantity: 1, price: 29.97 }
        ]
      };
      
      console.log('Testing direct notification function...');
      const notificationResult = await sendOrderConfirmationNotification(fid, orderDetails);
      
      results.tests.push({
        name: 'Direct Order Confirmation Notification',
        status: notificationResult.success ? 'PASSED' : 'FAILED',
        message: notificationResult.success 
          ? 'Notification sent successfully via Neynar' 
          : `Failed to send notification: ${notificationResult.error}`,
        data: {
          success: notificationResult.success,
          delivery: notificationResult.delivery,
          skipped: notificationResult.skipped,
          reason: notificationResult.reason,
          error: notificationResult.error,
          notificationId: notificationResult.notificationId
        }
      });
      
      if (notificationResult.success || notificationResult.skipped) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
    } catch (error) {
      results.tests.push({
        name: 'Direct Order Confirmation Notification',
        status: 'FAILED',
        message: error.message,
        data: { error: error.message }
      });
      results.summary.failed++;
    }
    
    // Test 2: Mock order object test
    if (orderId) {
      try {
        const mockOrder = {
          id: 1,
          order_id: orderId,
          fid: parseInt(fid),
          amount_total: '71.98',
          currency: 'USDC',
          line_items: [
            { title: 'Bankr Hoodie', quantity: 1, price: 60.00 },
            { title: 'Dickbutt Cap', quantity: 1, price: 29.97 }
          ],
          order_confirmation_sent: false,
          order_confirmation_sent_at: null
        };
        
        console.log('Testing order notification with mock order object...');
        const orderNotificationResult = await sendOrderConfirmationNotificationAndMark(mockOrder);
        
        results.tests.push({
          name: 'Order Object Notification Test',
          status: orderNotificationResult.success ? 'PASSED' : 'FAILED',
          message: orderNotificationResult.success 
            ? 'Order notification sent and would be marked in database' 
            : `Failed to send order notification: ${orderNotificationResult.error}`,
          data: {
            success: orderNotificationResult.success,
            delivery: orderNotificationResult.delivery,
            skipped: orderNotificationResult.skipped,
            reason: orderNotificationResult.reason,
            error: orderNotificationResult.error
          }
        });
        
        if (orderNotificationResult.success || orderNotificationResult.skipped) {
          results.summary.passed++;
        } else {
          results.summary.failed++;
        }
      } catch (error) {
        results.tests.push({
          name: 'Order Object Notification Test',
          status: 'FAILED',
          message: error.message,
          data: { error: error.message }
        });
        results.summary.failed++;
      }
    }
    
    // Test 3: Check notification setup
    try {
      const { isNeynarAvailable } = await import('@/lib/neynar');
      const neynarAvailable = isNeynarAvailable();
      
      results.tests.push({
        name: 'Neynar Configuration Check',
        status: neynarAvailable ? 'PASSED' : 'FAILED',
        message: neynarAvailable 
          ? 'Neynar client is properly configured' 
          : 'Neynar client is not available - check API key configuration',
        data: {
          neynarAvailable,
          hasApiKey: !!process.env.NEYNAR_API_KEY,
          hasClient: !!process.env.NEYNAR_CLIENT_ID
        }
      });
      
      if (neynarAvailable) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
    } catch (error) {
      results.tests.push({
        name: 'Neynar Configuration Check',
        status: 'FAILED',
        message: error.message,
        data: { error: error.message }
      });
      results.summary.failed++;
    }
    
    return NextResponse.json({
      success: true,
      message: `Notification fix test completed: ${results.summary.passed} passed, ${results.summary.failed} failed`,
      results,
      instructions: {
        usage: 'POST with { "fid": "466111", "orderId": "test-123" }',
        note: 'Tests the fixed notification system that no longer requires explicit token checks'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in notification fix test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

export async function GET() {
  return NextResponse.json({
    message: 'Order notification fix test endpoint',
    usage: 'POST with { "fid": "466111", "orderId": "optional-test-123" }',
    description: 'Tests the fixed notification system that works with Neynar managed notifications'
  });
} 