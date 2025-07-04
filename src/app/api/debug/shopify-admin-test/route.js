import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check environment variables
    const shopifyDomain = process.env.SHOPIFY_SITE_DOMAIN;
    const shopifyAdminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    
    const envCheck = {
      SHOPIFY_SITE_DOMAIN: !!shopifyDomain,
      SHOPIFY_ADMIN_ACCESS_TOKEN: !!shopifyAdminToken,
      domain: shopifyDomain ? `${shopifyDomain}.myshopify.com` : 'NOT SET',
      tokenLength: shopifyAdminToken ? shopifyAdminToken.length : 0,
      tokenPrefix: shopifyAdminToken ? shopifyAdminToken.substring(0, 10) + '...' : 'NOT SET'
    };
    
    console.log('🔍 Shopify Admin Environment Check:', envCheck);
    
    if (!shopifyDomain || !shopifyAdminToken) {
      return NextResponse.json({
        success: false,
        error: 'Missing Shopify Admin environment variables',
        check: envCheck
      }, { status: 500 });
    }
    
    // Test basic API access with a simple shop query
    const SHOPIFY_ADMIN_API_URL = `https://${shopifyDomain}.myshopify.com/admin/api/2024-10/graphql.json`;
    
    const testQuery = `
      query {
        shop {
          name
          email
          currencyCode
          ianaTimezone
        }
      }
    `;
    
    console.log('🔍 Testing Shopify Admin API with URL:', SHOPIFY_ADMIN_API_URL);
    
    const response = await fetch(SHOPIFY_ADMIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAdminToken,
      },
      body: JSON.stringify({
        query: testQuery
      }),
    });
    
    console.log('🔍 Shopify Admin API Response Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔍 Shopify Admin API Error Response:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Shopify Admin API request failed',
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        check: envCheck
      }, { status: 500 });
    }
    
    const data = await response.json();
    console.log('🔍 Shopify Admin API Response:', JSON.stringify(data, null, 2));
    
    if (data.errors) {
      console.error('🔍 Shopify Admin API GraphQL Errors:', data.errors);
      return NextResponse.json({
        success: false,
        error: 'Shopify Admin API GraphQL error',
        graphqlErrors: data.errors,
        check: envCheck
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Shopify Admin API is working correctly',
      shop: data.data.shop,
      check: envCheck
    });
    
  } catch (error) {
    console.error('🔍 Shopify Admin API Test Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 