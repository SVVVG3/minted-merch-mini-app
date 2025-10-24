import { withAdminAuth } from '@/lib/adminAuth';
export async function GET() {
  try {
    console.log('=== OG Order Debug Test ===');
    
    // Test with the exact parameters from order #1201
    const testParams = {
      orderNumber: '#1201',
      total: '1.09',
      products: '1 item',
      itemCount: '1',
      image: 'https://cdn.shopify.com/s/files/1/0677/1608/8089/files/GM_Templates_b04892c4-1769-4cea-b4ca-7430b02406d6.jpg?v=1697307289',
      t: Date.now().toString()
    };
    
    console.log('Test parameters:', testParams);
    
    // Test the actual OG route
    const ogUrl = `https://mintedmerch.vercel.app/api/og/order?${new URLSearchParams(testParams).toString()}`;
    console.log('Testing OG URL:', ogUrl);
    
    try {
      const ogResponse = await fetch(ogUrl);
      console.log('OG Response:', {
        status: ogResponse.status,
        statusText: ogResponse.statusText,
        contentType: ogResponse.headers.get('content-type'),
        contentLength: ogResponse.headers.get('content-length')
      });
      
      if (ogResponse.ok) {
        console.log('✅ OG image generated successfully');
      } else {
        console.log('❌ OG image generation failed');
      }
    } catch (error) {
      console.error('❌ Error testing OG route:', error);
    }
    
    // Test image fetching directly
    const imageUrl = testParams.image;
    console.log('Testing direct image fetch from:', imageUrl);
    
    try {
      const response = await fetch(imageUrl);
      console.log('Direct image fetch response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log('✅ Image fetched successfully:', {
          size: buffer.length,
          sizeKB: Math.round(buffer.length / 1024)
        });
      } else {
        console.log('❌ Image fetch failed');
      }
    } catch (error) {
      console.error('❌ Error fetching image:', error);
    }
    
    // Test the share button URL format
    const shareUrl = `https://mintedmerch.vercel.app/order/1201?t=${Date.now()}`;
    console.log('Testing share button URL format:', shareUrl);
    
    try {
      const shareResponse = await fetch(shareUrl);
      console.log('Share URL response:', {
        status: shareResponse.status,
        statusText: shareResponse.statusText
      });
      
      if (shareResponse.ok) {
        const html = await shareResponse.text();
        const frameMatch = html.match(/fc:frame[^>]*content="([^"]*)/);
        if (frameMatch) {
          const frameContent = frameMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          console.log('Frame metadata found:', frameContent);
          
          try {
            const frameData = JSON.parse(frameContent);
            console.log('Frame image URL:', frameData.imageUrl);
          } catch (e) {
            console.log('Could not parse frame data');
          }
        } else {
          console.log('No frame metadata found in HTML');
        }
      }
    } catch (error) {
      console.error('❌ Error testing share URL:', error);
    }
    
    return new Response(JSON.stringify({
      success: true,
      testParams,
      ogUrl,
      shareUrl,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Debug test error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 