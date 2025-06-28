export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber') || '1193';
    
    // Simulate the same logic as the order page metadata generation
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app').replace(/\/$/, '');
    
    // Test parameters that should be passed to OG image
    const testParams = {
      orderNumber: '#1193',  // This should be from database
      total: '1.09',
      products: '1 item',
      itemCount: '1',
      image: 'https://cdn.shopify.com/s/files/1/0677/1608/8089/files/custom-gm-artwork-test-front-67ba2245047dc.jpg'
    };
    
    const imageParams = new URLSearchParams(testParams);
    const dynamicImageUrl = `${baseUrl}/api/og/order?${imageParams.toString()}`;
    
    return Response.json({
      success: true,
      orderNumber,
      testParams,
      generatedOgUrl: dynamicImageUrl,
      instructions: 'Visit the generatedOgUrl to see the actual OG image'
    });
    
  } catch (error) {
    console.error('Error in OG order test:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 