export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber') || 'ORDER-123';
    const total = searchParams.get('total') || '0.00';
    const products = searchParams.get('products') || '1 item';
    const itemCount = parseInt(searchParams.get('itemCount') || '1');
    const imageUrl = searchParams.get('image');
    
    // Test parsing logic
    let displayOrderNumber = decodeURIComponent(orderNumber);
    displayOrderNumber = displayOrderNumber.replace(/^#+/, '#');
    
    const totalValue = parseFloat(total);
    const totalText = totalValue > 0 ? `${totalValue.toFixed(2)} USDC` : '0.00 USDC';
    
    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      rawParams: {
        orderNumber,
        total,
        products,
        itemCount: searchParams.get('itemCount'),
        imageUrl
      },
      processedValues: {
        displayOrderNumber,
        totalValue,
        totalText,
        products,
        itemCount,
        imageUrl: imageUrl ? 'provided' : 'missing'
      },
      urlDetails: {
        fullUrl: request.url,
        searchParamsString: searchParams.toString()
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 