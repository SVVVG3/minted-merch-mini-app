import { NextResponse } from 'next/server';
import { setUserContext } from '@/lib/auth';

export async function POST(request) {
  try {
    const { userFid, eventType = 'app.added', enableNotifications = true } = await request.json();
    
    if (!userFid) {
      return NextResponse.json({ 
        error: 'userFid is required' 
      }, { status: 400 });
    }

    console.log('Testing webhook with:', { userFid, eventType, enableNotifications });

    // 🔒 SECURITY: Set user context for RLS policies
    await setUserContext(userFid);

    // Simulate a webhook event
    const mockWebhookEvent = {
      type: eventType,
      data: {
        user: {
          fid: userFid
        },
        notification_details: enableNotifications ? {
          token: 'mock_token_123',
          url: 'https://api.neynar.com/webhook'
        } : null
      }
    };

    console.log('=== SIMULATING WEBHOOK EVENT ===');
    console.log('Mock event:', JSON.stringify(mockWebhookEvent, null, 2));

    // Send the mock event to our webhook endpoint
    const webhookResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockWebhookEvent)
    });

    const webhookResult = await webhookResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Test webhook event sent',
      mockEvent: mockWebhookEvent,
      webhookResponse: webhookResult
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Webhook test endpoint',
    usage: 'POST with { "userFid": 123, "eventType": "app.added", "enableNotifications": true }'
  });
} 