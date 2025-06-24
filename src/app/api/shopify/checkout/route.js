import { NextResponse } from 'next/server';

async function shopifyFetch(query, variables = {}) {
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Missing Shopify environment variables');
  }

  const SHOPIFY_API_URL = `https://${SHOPIFY_DOMAIN}.myshopify.com/api/2024-07/graphql.json`;

  const response = await fetch(SHOPIFY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();
  
  if (data.errors) {
    console.error('Shopify GraphQL errors:', data.errors);
    throw new Error(data.errors[0].message);
  }

  return data.data;
}

export async function POST(request) {
  try {
    const { cartItems, shippingAddress, email } = await request.json();

    console.log('Checkout calculation request:', {
      itemCount: cartItems?.length,
      shippingAddress: shippingAddress ? 'provided' : 'missing',
      email: email ? 'provided' : 'missing'
    });

    // Validate required data
    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Cart items are required' },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      );
    }

    // Convert cart items to Shopify line items format
    const lineItems = cartItems.map(item => {
      // Extract variant ID from the item
      let variantId = null;
      
      if (item.variant && item.variant.id) {
        variantId = item.variant.id;
      } else if (item.product && item.product.variants && item.product.variants.edges.length > 0) {
        // Use first variant if no specific variant selected
        variantId = item.product.variants.edges[0].node.id;
      }

      if (!variantId) {
        throw new Error(`No variant ID found for item: ${item.product?.title || 'Unknown'}`);
      }

      return {
        merchandiseId: variantId,
        quantity: item.quantity || 1
      };
    });

    console.log('Formatted line items:', lineItems);

    // Format shipping address for Shopify
    const shopifyShippingAddress = {
      address1: shippingAddress.address1,
      address2: shippingAddress.address2 || null,
      city: shippingAddress.city,
      province: shippingAddress.province,
      country: shippingAddress.country || 'US',
      zip: shippingAddress.zip,
      firstName: shippingAddress.firstName,
      lastName: shippingAddress.lastName,
      phone: shippingAddress.phone || null
    };

    // Create cart with line items using Storefront API
    const cartCreateQuery = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            estimatedCost {
              totalAmount {
                amount
                currencyCode
              }
              subtotalAmount {
                amount
                currencyCode
              }
              totalTaxAmount {
                amount
                currencyCode
              }
              totalDutyAmount {
                amount
                currencyCode
              }
            }
            lines(first: 50) {
              edges {
                node {
                  id
                  quantity
                  estimatedCost {
                    totalAmount {
                      amount
                      currencyCode
                    }
                  }
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        title
                        handle
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const cartInput = {
      lines: lineItems,
      buyerIdentity: {
        email: email || null,
        deliveryAddressPreferences: [
          {
            deliveryAddress: shopifyShippingAddress
          }
        ]
      }
    };

    console.log('Creating cart with input:', JSON.stringify(cartInput, null, 2));

    const cartData = await shopifyFetch(cartCreateQuery, { input: cartInput });

    if (cartData.cartCreate.userErrors.length > 0) {
      console.error('Cart creation errors:', cartData.cartCreate.userErrors);
      return NextResponse.json(
        { 
          error: 'Cart creation failed', 
          details: cartData.cartCreate.userErrors 
        },
        { status: 400 }
      );
    }

    const cart = cartData.cartCreate.cart;
    console.log('Cart created successfully:', {
      id: cart.id,
      checkoutUrl: cart.checkoutUrl,
      estimatedCost: cart.estimatedCost
    });

    // For the Storefront API, we get estimated costs but not detailed shipping rates
    // The actual shipping calculation happens during checkout
    const response = {
      cartId: cart.id,
      checkoutUrl: cart.checkoutUrl,
      subtotal: {
        amount: parseFloat(cart.estimatedCost.subtotalAmount.amount),
        currencyCode: cart.estimatedCost.subtotalAmount.currencyCode
      },
      tax: {
        amount: parseFloat(cart.estimatedCost.totalTaxAmount?.amount || '0'),
        currencyCode: cart.estimatedCost.totalTaxAmount?.currencyCode || 'USD'
      },
      total: {
        amount: parseFloat(cart.estimatedCost.totalAmount.amount),
        currencyCode: cart.estimatedCost.totalAmount.currencyCode
      },
      // Storefront API doesn't provide shipping rates in cart creation
      // These would need to be fetched separately or calculated during checkout
      shippingRates: [
        {
          handle: 'standard',
          title: 'Standard Shipping',
          price: {
            amount: 5.99,
            currencyCode: 'USD'
          }
        }
      ],
      shippingRatesReady: true,
      requiresShipping: true,
      lineItems: cart.lines.edges.map(edge => ({
        id: edge.node.id,
        title: edge.node.merchandise.product.title,
        quantity: edge.node.quantity,
        variant: {
          id: edge.node.merchandise.id,
          title: edge.node.merchandise.title,
          price: {
            amount: parseFloat(edge.node.merchandise.price.amount),
            currencyCode: edge.node.merchandise.price.currencyCode
          }
        }
      }))
    };

    console.log('Returning cart response:', {
      subtotal: response.subtotal.amount,
      tax: response.tax.amount,
      total: response.total.amount,
      shippingRatesCount: response.shippingRates.length,
      shippingRatesReady: response.shippingRatesReady
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Checkout calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate checkout', details: error.message },
      { status: 500 }
    );
  }
} 