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
    const variantId = searchParams.get('variantId') || '50352720183577'; // Default test variant

    console.log('🔍 Testing Shopify API connection...');
    console.log('🔍 Environment check:');
    console.log('- SHOPIFY_STORE_DOMAIN:', process.env.SHOPIFY_STORE_DOMAIN ? '✅ Set' : '❌ Missing');
    console.log('- SHOPIFY_ACCESS_TOKEN:', process.env.SHOPIFY_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');

    const cleanVariantId = extractVariantId(variantId);
    console.log('🔍 Testing variant ID:', cleanVariantId);
    
    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/variants/${cleanVariantId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('🔍 Shopify API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Shopify API error:', errorText);
      
      return NextResponse.json({
        success: false,
        error: `Shopify API error: ${response.status}`,
        details: errorText,
        variantId: cleanVariantId,
        environment: {
          shopifyDomain: process.env.SHOPIFY_STORE_DOMAIN ? 'Set' : 'Missing',
          shopifyToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Missing'
        }
      });
    }

    const variantData = await response.json();
    console.log('✅ Variant data:', JSON.stringify(variantData, null, 2));
    
    if (variantData.variant && variantData.variant.product_id) {
      // Now get the product details
      const productResponse = await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/products/${variantData.variant.product_id}.json`,
        {
          headers: {
            'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      );

      if (productResponse.ok) {
        const productData = await productResponse.json();
        console.log('✅ Product data:', JSON.stringify(productData, null, 2));
        
        return NextResponse.json({
          success: true,
          variantId: cleanVariantId,
          variant: {
            id: variantData.variant.id,
            title: variantData.variant.title,
            price: variantData.variant.price,
            product_id: variantData.variant.product_id
          },
          product: {
            id: productData.product.id,
            title: productData.product.title,
            handle: productData.product.handle
          },
          environment: {
            shopifyDomain: process.env.SHOPIFY_STORE_DOMAIN ? 'Set' : 'Missing',
            shopifyToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Missing'
          }
        });
      } else {
        const productErrorText = await productResponse.text();
        console.log('❌ Product API error:', productErrorText);
        
        return NextResponse.json({
          success: false,
          error: `Product API error: ${productResponse.status}`,
          details: productErrorText,
          variantData,
          environment: {
            shopifyDomain: process.env.SHOPIFY_STORE_DOMAIN ? 'Set' : 'Missing',
            shopifyToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Missing'
          }
        });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'No product_id found in variant data',
      variantData,
      environment: {
        shopifyDomain: process.env.SHOPIFY_STORE_DOMAIN ? 'Set' : 'Missing',
        shopifyToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Missing'
      }
    });

  } catch (error) {
    console.error('❌ Error in Shopify variant test:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      environment: {
        shopifyDomain: process.env.SHOPIFY_STORE_DOMAIN ? 'Set' : 'Missing',
        shopifyToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Missing'
      }
    });
  }
} 