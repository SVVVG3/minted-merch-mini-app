import { NextResponse } from 'next/server';

/**
 * Daimo Pay Webhook Handler - DISABLED
 * 
 * This endpoint exists to receive webhooks from Daimo but is currently disabled.
 * It immediately returns 200 OK to acknowledge receipt without processing.
 * 
 * WHY: This webhook was registered with a hat store's app ID by mistake.
 * Until we get a production Daimo API key and properly register this webhook
 * with OUR app ID, we just acknowledge and ignore all incoming webhooks.
 * 
 * TO RE-ENABLE: Once you have a production API key from Daimo:
 * 1. Contact Daimo to unregister the old hat store webhook
 * 2. Register this webhook properly with your app ID
 * 3. Restore the full processing logic (see git history for previous version)
 */

export async function POST(request) {
  try {
    const event = await request.json();
    
    // Log that we received a webhook but are ignoring it
    console.log('📩 Daimo webhook received but IGNORED (endpoint disabled):', {
      type: event.type,
      paymentId: event.paymentId,
      note: 'Webhook registered with wrong app ID - ignoring until properly configured'
    });

    // Return 200 OK to acknowledge receipt
    // This prevents Daimo from retrying
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received but processing disabled',
      note: 'This endpoint is disabled until production API key is configured'
    });

  } catch (error) {
    console.error('❌ Daimo webhook error:', error);
    
    // Still return 200 to prevent retries
    return NextResponse.json(
      { 
        success: false, 
        error: 'Processing disabled',
        message: error.message 
      },
      { status: 200 }
    );
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'disabled',
    service: 'daimo-pay-webhook',
    note: 'Webhook endpoint exists but processing is disabled',
    timestamp: new Date().toISOString()
  });
}

