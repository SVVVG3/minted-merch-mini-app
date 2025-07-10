import { NextResponse } from 'next/server';

// Helper function to extract variant ID from Shopify GraphQL ID
function extractVariantId(graphqlId) {
  if (typeof graphqlId === 'string' && graphqlId.includes('ProductVariant/')) {
    return graphqlId.split('ProductVariant/')[1];
  }
  return graphqlId;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('variantId') || '50352720183577'; // Default to one from the screenshot
    
    console.log(`🔍 Testing Shopify product fetch for variant: ${variantId}`);
    
    // Check environment variables
    const shopifyDomain = process.env.SHOPIFY_SITE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!shopifyDomain || !accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Missing Shopify credentials',
        hasShopifyDomain: !!shopifyDomain,
        hasAccessToken: !!accessToken,
        domainLength: shopifyDomain?.length,
        tokenLength: accessToken?.length
      });
    }
    
    const cleanVariantId = extractVariantId(variantId);
    console.log(`🔍 Clean variant ID: ${cleanVariantId}`);
    
    // Step 1: Fetch variant details
    const variantUrl = `https://${shopifyDomain}.myshopify.com/admin/api/2023-10/variants/${cleanVariantId}.json`;
    console.log(`📡 Fetching variant from: ${variantUrl}`);
    
    const variantResponse = await fetch(variantUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`📡 Variant response status: ${variantResponse.status}`);
    
    if (!variantResponse.ok) {
      const errorText = await variantResponse.text();
      console.log(`❌ Variant fetch error: ${errorText}`);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch variant: ${variantResponse.status}`,
        variantId: cleanVariantId,
        url: variantUrl,
        response: errorText,
        hasShopifyDomain: !!shopifyDomain,
        hasAccessToken: !!accessToken,
        domainLength: shopifyDomain?.length,
        tokenLength: accessToken?.length
      });
    }
    
    const variantData = await variantResponse.json();
    console.log(`✅ Variant data:`, variantData);
    
    if (!variantData.variant || !variantData.variant.product_id) {
      return NextResponse.json({
        success: false,
        error: 'No product ID found in variant data',
        variantData
      });
    }
    
    // Step 2: Fetch product details
    const productId = variantData.variant.product_id;
    const productUrl = `https://${shopifyDomain}.myshopify.com/admin/api/2023-10/products/${productId}.json`;
    console.log(`📡 Fetching product from: ${productUrl}`);
    
    const productResponse = await fetch(productUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`📡 Product response status: ${productResponse.status}`);
    
    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      console.log(`❌ Product fetch error: ${errorText}`);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch product: ${productResponse.status}`,
        productId,
        url: productUrl,
        response: errorText,
        variantData
      });
    }
    
    const productData = await productResponse.json();
    console.log(`✅ Product data:`, productData);
    
    return NextResponse.json({
      success: true,
      productInfo: {
        productTitle: productData.product.title,
        variantTitle: variantData.variant.title,
        productId: productId,
        variantId: cleanVariantId
      },
      rawData: {
        variant: variantData,
        product: productData
      }
    });
    
  } catch (error) {
    console.error('❌ Error in shopify-product-fetch-test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 