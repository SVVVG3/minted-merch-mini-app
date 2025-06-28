import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'product';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app';

    let testResults = [];

    if (type === 'product') {
      // Test product OG image
      const handle = 'bankr-cap';
      const ogUrl = `${baseUrl}/api/og/product?handle=${handle}`;
      
      try {
        const response = await fetch(ogUrl);
        testResults.push({
          type: 'Product OG Image',
          url: ogUrl,
          status: response.status,
          contentType: response.headers.get('content-type'),
          cacheControl: response.headers.get('cache-control'),
          success: response.ok && response.headers.get('content-type')?.includes('image')
        });
      } catch (error) {
        testResults.push({
          type: 'Product OG Image',
          url: ogUrl,
          error: error.message,
          success: false
        });
      }
    }

    if (type === 'order') {
      // Test order OG image
      const ogUrl = `${baseUrl}/api/og/order?order=TEST123&total=25.50&products=Test%20Product`;
      
      try {
        const response = await fetch(ogUrl);
        testResults.push({
          type: 'Order OG Image',
          url: ogUrl,
          status: response.status,
          contentType: response.headers.get('content-type'),
          cacheControl: response.headers.get('cache-control'),
          success: response.ok && response.headers.get('content-type')?.includes('image')
        });
      } catch (error) {
        testResults.push({
          type: 'Order OG Image',
          url: ogUrl,
          error: error.message,
          success: false
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'OG Image Generation Test Results',
      testResults,
      instructions: {
        usage: 'Use ?type=product or ?type=order to test specific image types',
        directTest: 'Copy any URL and paste in browser to see the generated image',
        debugging: 'Check status, contentType, and cacheControl for issues'
      }
    });

  } catch (error) {
    console.error('OG Image test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 