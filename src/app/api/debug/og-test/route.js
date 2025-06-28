import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'product'; // 'product' or 'order'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app';

    let testUrls = [];

    if (type === 'product' || type === 'all') {
      // Test product OG images
      const productHandles = ['bankr-cap', 'ok-custom-t-shirt', 'test-product'];
      
      testUrls.push({
        type: 'Product Images',
        urls: productHandles.map(handle => ({
          name: `Product: ${handle}`,
          url: `${baseUrl}/api/og/product?handle=${handle}`,
          testUrl: `${baseUrl}/product/${handle}`,
        }))
      });
    }

    if (type === 'order' || type === 'all') {
      // Test order OG images
      testUrls.push({
        type: 'Order Images',
        urls: [
          {
            name: 'Order: Simple',
            url: `${baseUrl}/api/og/order?order=1234&total=25.50`,
            testUrl: `${baseUrl}/order/1234?total=25.50`,
          },
          {
            name: 'Order: With Products',
            url: `${baseUrl}/api/og/order?order=5678&total=45.99&products=${encodeURIComponent('Bankr Cap and OK Custom T-Shirt')}`,
            testUrl: `${baseUrl}/order/5678?total=45.99&products=${encodeURIComponent('Bankr Cap and OK Custom T-Shirt')}`,
          },
          {
            name: 'Order: Single Product',
            url: `${baseUrl}/api/og/order?order=9999&total=15.25&products=${encodeURIComponent('Bankr Cap (2x)')}`,
            testUrl: `${baseUrl}/order/9999?total=15.25&products=${encodeURIComponent('Bankr Cap (2x)')}`,
          }
        ]
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Dynamic OG Image Test URLs',
      baseUrl,
      testUrls,
      instructions: {
        directTest: 'Copy any URL and paste in browser to see the generated image',
        metaTest: 'Use testUrl in social media debuggers to see how it appears in feeds',
        farcasterTest: 'Share any testUrl in Farcaster to see the Mini App embed'
      }
    });

  } catch (error) {
    console.error('OG Test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 