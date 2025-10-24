import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    
    if (!neynarApiKey) {
      return NextResponse.json({
        success: false,
        error: 'NEYNAR_API_KEY not found'
      }, { status: 500 });
    }
    
    console.log('🔍 Testing Neynar notification tokens API...');
    
    // Test the API call
    const response = await fetch(`https://api.neynar.com/v2/farcaster/frame/notification_tokens/`, {
      method: 'GET',
      headers: {
        'x-api-key': neynarApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 API Response status:', response.status);
    console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📡 Raw response:', responseText);
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON response from Neynar',
        rawResponse: responseText,
        status: response.status
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      hasApiKey: !!neynarApiKey,
      apiKeyLength: neynarApiKey?.length,
      data: parsedData,
      tokenCount: parsedData?.notification_tokens?.length || 0,
      enabledTokenCount: parsedData?.notification_tokens?.filter(t => t.status === 'enabled').length || 0
    });
    
  } catch (error) {
    console.error('❌ Error in neynar-notification-test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});