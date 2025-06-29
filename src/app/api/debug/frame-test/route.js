import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'product';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app';

    let frameTests = [];

    if (type === 'product') {
      const handle = 'bankr-cap';
      const dynamicImageUrl = `${baseUrl}/api/og/product?handle=${handle}`;
      
      const frame = {
        version: "1",
        imageUrl: dynamicImageUrl,
        button: {
          title: `Buy Bankr Cap 📦`,
          action: {
            type: "launch_frame",
            url: `${baseUrl}/product/${handle}`,
            name: "Minted Merch Shop",
            splashImageUrl: `${baseUrl}/splash.png`,
            splashBackgroundColor: "#000000"
          }
        }
      };

      frameTests.push({
        type: 'Product Frame',
        url: `${baseUrl}/product/${handle}`,
        frameData: frame,
        frameString: JSON.stringify(frame),
        validation: {
          hasVersion: !!frame.version,
          versionIsOne: frame.version === "1",
          hasImageUrl: !!frame.imageUrl,
          imageUrlLength: frame.imageUrl.length,
          imageUrlValid: frame.imageUrl.length <= 1024,
          hasButton: !!frame.button,
          hasButtonTitle: !!frame.button?.title,
          hasButtonAction: !!frame.button?.action,
          actionTypeCorrect: frame.button?.action?.type === "launch_frame",
          hasActionUrl: !!frame.button?.action?.url,
        }
      });
    }

    if (type === 'order') {
      const orderNumber = 'TEST123';
      const total = '25.50';
      const products = 'Test Product';
      const dynamicImageUrl = `${baseUrl}/api/og/order?order=${encodeURIComponent(orderNumber)}&total=${encodeURIComponent(total)}&products=${encodeURIComponent(products)}`;
      
      const frame = {
        version: "1",
        imageUrl: dynamicImageUrl,
        button: {
          title: "Shop More 🛒",
          action: {
            type: "launch_frame",
            url: baseUrl,
            name: "Minted Merch Shop",
            splashImageUrl: `${baseUrl}/splash.png`,
            splashBackgroundColor: "#000000"
          }
        }
      };

      frameTests.push({
        type: 'Order Frame',
        url: `${baseUrl}/order/${orderNumber}?total=${total}&products=${products}`,
        frameData: frame,
        frameString: JSON.stringify(frame),
        validation: {
          hasVersion: !!frame.version,
          versionIsOne: frame.version === "1",
          hasImageUrl: !!frame.imageUrl,
          imageUrlLength: frame.imageUrl.length,
          imageUrlValid: frame.imageUrl.length <= 1024,
          hasButton: !!frame.button,
          hasButtonTitle: !!frame.button?.title,
          hasButtonAction: !!frame.button?.action,
          actionTypeCorrect: frame.button?.action?.type === "launch_frame",
          hasActionUrl: !!frame.button?.action?.url,
        }
      });
    }

    // Test image accessibility
    const imageTests = [];
    for (const test of frameTests) {
      try {
        const response = await fetch(test.frameData.imageUrl);
        imageTests.push({
          url: test.frameData.imageUrl,
          status: response.status,
          contentType: response.headers.get('content-type'),
          cacheControl: response.headers.get('cache-control'),
          accessible: response.ok
        });
      } catch (error) {
        imageTests.push({
          url: test.frameData.imageUrl,
          error: error.message,
          accessible: false
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Frame Metadata Test Results',
      frameTests,
      imageTests,
      recommendations: {
        farcasterDocs: 'https://miniapps.farcaster.xyz/docs/guides/sharing',
        embedTester: 'Use Warpcast Mini App Embed Tool to test these URLs',
        debugUrls: frameTests.map(test => test.url)
      }
    });

  } catch (error) {
    console.error('Frame test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 