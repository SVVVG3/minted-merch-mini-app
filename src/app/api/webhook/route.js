import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    
    // Get raw body for logging
    const rawBody = await request.text();
    console.log('Webhook raw body received, length:', rawBody.length);
    console.log('Raw body sample:', rawBody.substring(0, 200));
    
    // Since we're using Neynar's managed notification system,
    // we don't need to handle webhook events here anymore.
    // Neynar handles all frame_added, notifications_enabled events automatically.
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received (using Neynar managed notifications)',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 });
  }
}

// GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Minted Merch webhook endpoint is active (Neynar managed)',
    timestamp: new Date().toISOString()
  });
} 