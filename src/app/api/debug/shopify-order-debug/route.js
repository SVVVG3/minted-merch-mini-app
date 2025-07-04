import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Get the failed transaction hash from the request
    const { transactionHash } = await request.json();
    
    console.log('🔍 DEBUG: Investigating order creation failure for transaction:', transactionHash);
    
    // Test different line item formats to see what Shopify expects
    const testVariants = [
      {
        name: "Current Format",
        lineItems: [{
          variantId: "gid://shopify/ProductVariant/48690470551846",
          quantity: 1,
          priceSet: {
            shopMoney: {
              amount: "29.99",
              currencyCode: "USD"
            }
          }
        }]
      },
      {
        name: "Alternative Format 1",
        lineItems: [{
          variantId: "gid://shopify/ProductVariant/48690470551846",
          quantity: 1,
          price: "29.99"
        }]
      },
      {
        name: "Alternative Format 2", 
        lineItems: [{
          variantId: "gid://shopify/ProductVariant/48690470551846",
          quantity: 1
        }]
      }
    ];
    
    const results = [];
    
    for (const variant of testVariants) {
      console.log(`🔍 Testing ${variant.name}:`, JSON.stringify(variant.lineItems, null, 2));
      
      const testOrderData = {
        order: {
          lineItems: variant.lineItems,
          shippingAddress: {
            firstName: "Test",
            lastName: "User",
            address1: "123 Test St",
            city: "Test City",
            province: "CA",
            zip: "12345",
            country: "United States",
            phone: "555-1234"
          },
          email: "test@example.com",
          note: `Test order for debugging line items format - ${variant.name}`,
          transactions: [{
            kind: 'SALE',
            status: 'SUCCESS',
            amountSet: {
              shopMoney: {
                amount: "37.14",
                currencyCode: 'USD'
              }
            },
            gateway: 'USDC Base Network'
          }]
        }
      };
      
      // Test the GraphQL mutation
      const mutation = `
        mutation orderCreate($order: OrderCreateOrderInput!) {
          orderCreate(order: $order) {
            order {
              id
              name
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      try {
        const shopifyDomain = process.env.SHOPIFY_SITE_DOMAIN;
        const shopifyAdminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
        const SHOPIFY_ADMIN_API_URL = `https://${shopifyDomain}.myshopify.com/admin/api/2024-10/graphql.json`;
        
        const response = await fetch(SHOPIFY_ADMIN_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': shopifyAdminToken,
          },
          body: JSON.stringify({
            query: mutation,
            variables: testOrderData
          }),
        });
        
        const data = await response.json();
        
        results.push({
          variant: variant.name,
          success: response.ok && !data.errors && data.data.orderCreate.userErrors.length === 0,
          response: data,
          lineItemsFormat: variant.lineItems
        });
        
        console.log(`🔍 ${variant.name} result:`, {
          success: response.ok,
          hasErrors: !!data.errors,
          userErrors: data.data?.orderCreate?.userErrors || []
        });
        
      } catch (error) {
        results.push({
          variant: variant.name,
          success: false,
          error: error.message,
          lineItemsFormat: variant.lineItems
        });
        
        console.error(`🔍 ${variant.name} error:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: "Order creation debugging complete",
      transactionHash,
      results
    });
    
  } catch (error) {
    console.error('🔍 Order creation debug error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 