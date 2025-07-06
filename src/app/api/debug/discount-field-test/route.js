import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle') || 'bankr-cap';
    const fid = searchParams.get('fid') || '466111';
    
    console.log(`🔍 Testing discount field availability for ${handle} with FID ${fid}`);
    
    // Test the same flow as the ProductDetail component
    const baseUrl = new URL(request.url).origin;
    const productResponse = await fetch(`${baseUrl}/api/shopify/products?handle=${handle}&fid=${fid}`);
    
    if (!productResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch product: ${productResponse.status}`
      }, { status: 500 });
    }
    
    const productData = await productResponse.json();
    
    // Check if we have discount data
    const bestDiscount = productData.availableDiscounts?.best;
    
    if (!bestDiscount) {
      return NextResponse.json({
        success: false,
        message: 'No discount available for this product/user combination',
        productData: {
          title: productData.title,
          handle: productData.handle,
          availableDiscounts: productData.availableDiscounts
        }
      });
    }
    
    // Return detailed discount field information
    return NextResponse.json({
      success: true,
      message: 'Discount data analysis',
      discount: {
        code: bestDiscount.code,
        displayText: bestDiscount.displayText,
        discount_description: bestDiscount.discount_description,
        gating_type: bestDiscount.gating_type,
        discount_value: bestDiscount.discount_value,
        discount_type: bestDiscount.discount_type,
        discount_scope: bestDiscount.discount_scope,
        isTokenGated: bestDiscount.isTokenGated,
        // Show all available fields for debugging
        allFields: Object.keys(bestDiscount).sort()
      },
      analysis: {
        hasDiscountDescription: !!bestDiscount.discount_description,
        discountDescriptionValue: bestDiscount.discount_description,
        shouldShowDescription: !!bestDiscount.discount_description && bestDiscount.gating_type && bestDiscount.gating_type !== 'none'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in discount field test:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 