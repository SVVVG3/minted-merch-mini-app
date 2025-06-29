export async function GET() {
  try {
    console.log('=== OG Order Debug Test ===');
    
    // Test with the exact parameters from order #1196
    const testParams = {
      orderNumber: '#1196',
      total: '1.09',
      products: '1 item',
      itemCount: '1',
      image: 'https://cdn.shopify.com/s/files/1/0677/1608/8089/files/GM_Templates_b04892c4-1769-4cea-b4ca-7430b02406d6.jpg?v=1697307289'
    };
    
    console.log('Test parameters:', testParams);
    
    // Test image fetching directly
    const imageUrl = testParams.image;
    console.log('Testing image fetch from:', imageUrl);
    
    try {
      const response = await fetch(imageUrl);
      console.log('Image fetch response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        console.log('Image data received:', {
          size: arrayBuffer.byteLength,
          contentType: response.headers.get('content-type')
        });
        
        // Convert to data URL
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        
        console.log('Data URL created successfully, length:', dataUrl.length);
        
        // Test OG image generation
        const ogParams = new URLSearchParams(testParams);
        const ogUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/og/order?${ogParams.toString()}`;
        
        console.log('Generated OG URL:', ogUrl);
        
        return Response.json({
          success: true,
          message: 'Image fetch test successful',
          imageUrl,
          imageFetchStatus: response.status,
          imageSize: arrayBuffer.byteLength,
          contentType: response.headers.get('content-type'),
          dataUrlLength: dataUrl.length,
          ogUrl,
          testParams
        });
        
      } else {
        console.error('Image fetch failed:', response.status, response.statusText);
        return Response.json({
          success: false,
          error: 'Image fetch failed',
          status: response.status,
          statusText: response.statusText,
          imageUrl
        });
      }
      
    } catch (fetchError) {
      console.error('Error fetching image:', fetchError);
      return Response.json({
        success: false,
        error: 'Image fetch error',
        message: fetchError.message,
        imageUrl
      });
    }
    
  } catch (error) {
    console.error('Debug test error:', error);
    return Response.json({
      success: false,
      error: 'Debug test failed',
      message: error.message
    });
  }
} 