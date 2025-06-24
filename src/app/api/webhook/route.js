import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Log the webhook event for debugging
    console.log('Farcaster webhook received:', {
      timestamp: new Date().toISOString(),
      event: body
    });

    // Handle different webhook events
    switch (body.type) {
      case 'app.added':
        console.log('App was added by user:', body.data?.user?.fid);
        break;
      
      case 'app.removed':
        console.log('App was removed by user:', body.data?.user?.fid);
        break;
      
      case 'notification.clicked':
        console.log('Notification clicked by user:', body.data?.user?.fid);
        break;
      
      default:
        console.log('Unknown webhook event type:', body.type);
    }

    // Return success response
    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Webhook error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process webhook' 
      },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ 
    message: 'Minted Merch Farcaster webhook endpoint',
    status: 'active'
  });
} 