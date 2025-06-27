import { NextResponse } from 'next/server';
import { isNeynarAvailable, fetchNotificationTokensFromNeynar, neynarClient } from '@/lib/neynar';

export async function GET() {
  try {
    console.log('=== NEYNAR TEST DEBUG ===');
    
    // Check if Neynar is available
    const available = isNeynarAvailable();
    console.log('Neynar available:', available);
    
    if (!available) {
      return NextResponse.json({
        success: false,
        error: 'Neynar client not configured',
        message: 'Please set NEYNAR_API_KEY environment variable',
        envCheck: {
          NEYNAR_API_KEY: !!process.env.NEYNAR_API_KEY,
          NEYNAR_CLIENT_ID: !!process.env.NEYNAR_CLIENT_ID
        }
      });
    }
    
    // Test basic API connectivity
    let apiTest = { success: false, error: 'Not tested' };
    
    try {
      // Try to get notification tokens as a basic API test
      const tokenResult = await fetchNotificationTokensFromNeynar([]);
      apiTest = tokenResult;
      console.log('API connectivity test result:', tokenResult);
    } catch (error) {
      console.error('API connectivity test failed:', error);
      apiTest = { success: false, error: error.message };
    }
    
    return NextResponse.json({
      success: true,
      neynarStatus: {
        available: true,
        clientInitialized: !!neynarClient,
        apiConnectivity: apiTest
      },
      environment: {
        NEYNAR_API_KEY: !!process.env.NEYNAR_API_KEY,
        NEYNAR_CLIENT_ID: process.env.NEYNAR_CLIENT_ID || 'default-client-id',
        APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app'
      },
      message: 'Neynar client setup and connectivity test completed'
    });

  } catch (error) {
    console.error('Neynar test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      details: 'Neynar setup test failed'
    }, { status: 500 });
  }
}

// POST endpoint to test sending a notification (for manual testing)
export async function POST(request) {
  try {
    const { userFid, testType = 'welcome' } = await request.json();
    
    if (!userFid) {
      return NextResponse.json({
        success: false,
        error: 'userFid is required for notification test'
      }, { status: 400 });
    }
    
    if (!isNeynarAvailable()) {
      return NextResponse.json({
        success: false,
        error: 'Neynar client not configured'
      }, { status: 500 });
    }
    
    // Test notification sending
    let result;
    
    switch (testType) {
      case 'welcome':
        const { sendWelcomeNotification } = await import('@/lib/neynar');
        result = await sendWelcomeNotification(userFid);
        break;
      case 'order':
        const { sendOrderConfirmationNotification } = await import('@/lib/neynar');
        result = await sendOrderConfirmationNotification(userFid, 'TEST-001', '25.50');
        break;
      case 'shipping':
        const { sendShippingNotification } = await import('@/lib/neynar');
        result = await sendShippingNotification(userFid, 'TEST-001', 'TRACK123', 'UPS');
        break;
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test type. Use: welcome, order, or shipping'
        }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      testType,
      userFid,
      notificationResult: result,
      message: `Test ${testType} notification attempt completed`
    });
    
  } catch (error) {
    console.error('Notification test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Notification test failed'
    }, { status: 500 });
  }
} 