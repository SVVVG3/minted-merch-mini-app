import { NextResponse } from 'next/server';

async function shopifyAdminFetch(query, variables = {}) {
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
  const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
    throw new Error('Missing Shopify Admin API environment variables');
  }

  const SHOPIFY_ADMIN_API_URL = `https://${SHOPIFY_DOMAIN}.myshopify.com/admin/api/2024-10/graphql.json`;

  const response = await fetch(SHOPIFY_ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify Admin API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    console.error('Shopify Admin API GraphQL errors:', data.errors);
    throw new Error(`Shopify Admin API GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

async function shopifyStorefrontFetch(query, variables = {}) {
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Missing Shopify Storefront API environment variables');
  }

  const SHOPIFY_API_URL = `https://${SHOPIFY_DOMAIN}.myshopify.com/api/2024-10/graphql.json`;

  const response = await fetch(SHOPIFY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify Storefront API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    console.error('Shopify Storefront API GraphQL errors:', data.errors);
    throw new Error(`Shopify Storefront API GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

async function calculateWithAdminAPI(cartItems, shippingAddress, email) {
  console.log('🎯 Using Admin GraphQL API draftOrderCalculate for accurate tax calculation...');
  
  // Convert cart items to Shopify draft order line items format for GraphQL
  const lineItems = cartItems.map(item => {
    let variantId = null;
    
    if (item.variant && item.variant.id) {
      variantId = item.variant.id; // Keep full GID for GraphQL
    } else if (item.product && item.product.variants && item.product.variants.edges.length > 0) {
      variantId = item.product.variants.edges[0].node.id;
    }

    if (!variantId) {
      throw new Error(`No variant ID found for item: ${item.product?.title || 'Unknown'}`);
    }

    // Check if the variant requires shipping (based on weight or requiresShipping flag)
    let requiresShipping = true; // Default to requiring shipping
    
    if (item.variant) {
      // If variant has requiresShipping flag, use it
      if (typeof item.variant.requiresShipping === 'boolean') {
        requiresShipping = item.variant.requiresShipping;
      } 
      // If variant has weight = 0, it doesn't require shipping
      else if (item.variant.weight === 0 || item.variant.weight === '0') {
        requiresShipping = false;
        console.log(`📦 Product "${item.product?.title}" has 0 weight, setting requiresShipping = false`);
      }
    }
    
    // Product-specific overrides for known free shipping items (temporary fix)
    const freeShippingProducts = ['Opepin', 'Gift Card'];
    if (item.product && freeShippingProducts.includes(item.product.title)) {
      requiresShipping = false;
      console.log(`📦 Product "${item.product.title}" is in free shipping list, setting requiresShipping = false`);
    }

    return {
      variantId: variantId,
      quantity: item.quantity || 1,
      requiresShipping: requiresShipping,
      taxable: true
    };
  });

  // Format addresses for Shopify GraphQL API
  const shippingAddressData = {
    firstName: shippingAddress.firstName,
    lastName: shippingAddress.lastName,
    address1: shippingAddress.address1,
    address2: shippingAddress.address2 || null,
    city: shippingAddress.city,
    provinceCode: shippingAddress.province,
    countryCode: shippingAddress.country || 'US',
    zip: shippingAddress.zip,
    phone: shippingAddress.phone || null
  };

  // Create draft order input for GraphQL mutation
  const draftOrderInput = {
    lineItems: lineItems,
    shippingAddress: shippingAddressData,
    billingAddress: shippingAddressData,
    email: email || null,
    taxExempt: false
  };

  console.log('📦 Calculating draft order with GraphQL:', {
    lineItemsCount: lineItems.length,
    shippingAddress: `${shippingAddress.city}, ${shippingAddress.province}`,
    lineItems: lineItems.map(item => `${item.variantId} x${item.quantity}`)
  });

  // Use GraphQL draftOrderCalculate mutation for accurate tax/shipping calculation
  const draftOrderCalculateQuery = `
    mutation draftOrderCalculate($input: DraftOrderInput!) {
      draftOrderCalculate(input: $input) {
        calculatedDraftOrder {
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalShippingPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          availableShippingRates {
            title
            handle
            price {
              amount
              currencyCode
            }
          }
          lineItems {
            title
            quantity
            variant {
              id
              title
            }
            discountedTotalSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
          currencyCode
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: draftOrderInput
  };

  console.log('🔍 Sending draftOrderCalculate mutation...');
  const result = await shopifyAdminFetch(draftOrderCalculateQuery, variables);

  if (result.draftOrderCalculate.userErrors && result.draftOrderCalculate.userErrors.length > 0) {
    console.error('❌ draftOrderCalculate mutation errors:', result.draftOrderCalculate.userErrors);
    throw new Error(`draftOrderCalculate failed: ${result.draftOrderCalculate.userErrors.map(e => e.message).join(', ')}`);
  }

  const calculatedOrder = result.draftOrderCalculate.calculatedDraftOrder;

  if (!calculatedOrder) {
    throw new Error('draftOrderCalculate returned null calculated order');
  }

  console.log('✅ draftOrderCalculate successful:', {
    subtotal: calculatedOrder.subtotalPriceSet.shopMoney.amount,
    totalTax: calculatedOrder.totalTaxSet.shopMoney.amount,
    totalShipping: calculatedOrder.totalShippingPriceSet.shopMoney.amount,
    totalPrice: calculatedOrder.totalPriceSet.shopMoney.amount,
    availableShippingRates: calculatedOrder.availableShippingRates.length,
    currency: calculatedOrder.currencyCode
  });

  // Format shipping rates
  const shippingRates = calculatedOrder.availableShippingRates.map(rate => ({
    handle: rate.handle,
    title: rate.title,
    price: {
      amount: parseFloat(rate.price.amount),
      currencyCode: rate.price.currencyCode
    }
  }));

  // Check if any line items actually require shipping
  const anyRequiresShipping = lineItems.some(item => item.requiresShipping);
  console.log(`📦 Cart shipping requirements: ${anyRequiresShipping ? 'Some items require shipping' : 'No items require shipping'}`);
  
  // If no items require shipping, add a free shipping option
  if (!anyRequiresShipping) {
    console.log(`📦 No items require shipping, adding free shipping option`);
    shippingRates.unshift({
      handle: 'free-digital-delivery',
      title: 'FREE Shipping',
      price: {
        amount: 0,
        currencyCode: 'USD'
      }
    });
  }

  return {
    cartId: `calculated-draft-order-${Date.now()}`,
    checkoutUrl: null,
    subtotal: {
      amount: parseFloat(calculatedOrder.subtotalPriceSet.shopMoney.amount),
      currencyCode: calculatedOrder.subtotalPriceSet.shopMoney.currencyCode
    },
    tax: {
      amount: parseFloat(calculatedOrder.totalTaxSet.shopMoney.amount),
      currencyCode: calculatedOrder.totalTaxSet.shopMoney.currencyCode
    },
    total: {
      amount: parseFloat(calculatedOrder.totalPriceSet.shopMoney.amount),
      currencyCode: calculatedOrder.totalPriceSet.shopMoney.currencyCode
    },
    shippingRates: shippingRates,
    shippingRatesReady: true,
    requiresShipping: anyRequiresShipping,
    lineItems: calculatedOrder.lineItems.map((item, index) => ({
      id: `calculated-line-${index}`,
      title: item.title,
      quantity: item.quantity,
      variant: {
        id: item.variant.id,
        title: item.variant.title || 'Default',
        price: {
          amount: parseFloat(item.discountedTotalSet.shopMoney.amount) / item.quantity,
          currencyCode: item.discountedTotalSet.shopMoney.currencyCode
        }
      }
    }))
  };
}

async function calculateWithStorefrontAPI(cartItems, shippingAddress, email) {
  console.log('⚠️ Using Storefront API fallback (estimated costs only)...');
  
  // Convert cart items to Shopify line items format
  const lineItems = cartItems.map((item, index) => {
    console.log(`Processing cart item ${index}:`, {
      hasVariant: !!item.variant,
      variantId: item.variant?.id || 'NOT FOUND',
      hasProduct: !!item.product,
      productTitle: item.product?.title || 'NO TITLE',
      quantity: item.quantity,
      itemStructure: Object.keys(item)
    });

    let variantId = null;
    
    if (item.variant && item.variant.id) {
      variantId = item.variant.id;
      console.log(`✅ Found variant ID from item.variant.id: ${variantId}`);
    } else if (item.product && item.product.variants && item.product.variants.edges.length > 0) {
      variantId = item.product.variants.edges[0].node.id;
      console.log(`✅ Found variant ID from product.variants: ${variantId}`);
    }

    if (!variantId) {
      console.error(`❌ No variant ID found for item ${index}:`, {
        item: item,
        variantStructure: item.variant ? Object.keys(item.variant) : 'NO VARIANT',
        productStructure: item.product ? Object.keys(item.product) : 'NO PRODUCT'
      });
      throw new Error(`No variant ID found for item: ${item.product?.title || 'Unknown'}`);
    }

    const lineItem = {
      merchandiseId: variantId,
      quantity: item.quantity || 1
    };

    console.log(`✅ Created line item for ${item.product?.title}:`, lineItem);
    return lineItem;
  });

  console.log('📦 Final line items for Shopify:', lineItems);

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
          }
          deliveryGroups(first: 1) {
            edges {
              node {
                id
                deliveryOptions {
                  title
                  handle
                }
              }
            }
          }
          lines(first: 50) {
            edges {
              node {
                id
                quantity
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

  const cartData = await shopifyStorefrontFetch(cartCreateQuery, { input: cartInput });

  if (cartData.cartCreate.userErrors.length > 0) {
    throw new Error(`Cart creation failed: ${JSON.stringify(cartData.cartCreate.userErrors)}`);
  }

  const cart = cartData.cartCreate.cart;

  // Use actual Shopify calculations instead of estimates
  const subtotal = parseFloat(cart.estimatedCost.subtotalAmount.amount);
  let actualTax = parseFloat(cart.estimatedCost.totalTaxAmount?.amount || 0);
  const actualTotal = parseFloat(cart.estimatedCost.totalAmount.amount);
  
  // Note: Storefront API has known limitations with tax calculation
  // If tax is 0, it's likely due to Shopify's nexus-based tax collection
  if (actualTax === 0 && actualTotal > subtotal) {
    console.log('ℹ️ Storefront API returned 0 tax (likely due to nexus requirements):', {
      subtotal: subtotal,
      reportedTax: actualTax,
      total: actualTotal,
      shippingAmount: actualTotal - subtotal
    });
  }
  
  // Calculate shipping as the difference (Total - Subtotal - Tax)
  let actualShipping = actualTotal - subtotal - actualTax;
  let shippingTitle = 'Shipping';
  
  // Try to get shipping title from delivery groups (but calculate amount from total)
  if (cart.deliveryGroups?.edges?.length > 0) {
    const deliveryGroup = cart.deliveryGroups.edges[0].node;
    if (deliveryGroup.deliveryOptions?.length > 0) {
      const deliveryOption = deliveryGroup.deliveryOptions[0];
      shippingTitle = deliveryOption.title || 'Shipping';
      console.log('📦 Using delivery group title:', {
        title: shippingTitle,
        calculatedAmount: actualShipping
      });
    }
  }

  console.log('🔍 Shopify actual calculations:', {
    subtotal: subtotal,
    tax: actualTax,
    total: actualTotal,
    calculatedShipping: actualShipping,
    deliveryGroupsAvailable: cart.deliveryGroups?.edges?.length || 0
  });

  return {
    cartId: cart.id,
    checkoutUrl: cart.checkoutUrl,
    subtotal: {
      amount: subtotal,
      currencyCode: cart.estimatedCost.subtotalAmount.currencyCode
    },
    tax: {
      amount: actualTax,
      currencyCode: cart.estimatedCost.totalTaxAmount?.currencyCode || 'USD'
    },
    total: {
      amount: actualTotal,
      currencyCode: cart.estimatedCost.totalAmount.currencyCode
    },
    shippingRates: [
      {
        handle: 'shopify-calculated',
        title: actualShipping === 0 ? 'FREE Shipping' : shippingTitle,
        price: {
          amount: actualShipping,
          currencyCode: 'USD'
        }
      }
    ],
    shippingRatesReady: true, // Mark as true since these are real Shopify calculations
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
}

export async function POST(request) {
  try {
    const { cartItems, shippingAddress, email } = await request.json();

    console.log('Checkout calculation request:', {
      itemCount: cartItems.length,
      cartItems: cartItems.map(item => ({
        title: item.product?.title || 'Unknown',
        variantId: item.variant?.id || 'No variant',
        quantity: item.quantity
      })),
      shippingAddress: shippingAddress,
      email: email
    });

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'No cart items provided' },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      );
    }

    let response;

    // Try Admin API first for accurate calculations
    try {
      console.log('🎯 Trying Admin API with items:', cartItems.length);
      response = await calculateWithAdminAPI(cartItems, shippingAddress, email);
      console.log('✅ Admin API calculation successful:', {
        subtotal: response.subtotal.amount,
        tax: response.tax.amount,
        total: response.total.amount,
        shippingRatesCount: response.shippingRates.length,
        shippingRates: response.shippingRates.map(r => `${r.title}: $${r.price.amount}`)
      });
    } catch (adminError) {
      console.warn('❌ Admin API failed, falling back to Storefront API:', adminError.message);
      
      // Fall back to Storefront API with estimates
      try {
        console.log('⚠️ Trying Storefront API fallback with items:', cartItems.length);
        response = await calculateWithStorefrontAPI(cartItems, shippingAddress, email);
        console.log('⚠️ Storefront API fallback successful (estimated values):', {
          subtotal: response.subtotal.amount,
          tax: response.tax.amount,
          total: response.total.amount,
          shippingRatesCount: response.shippingRates.length
        });
      } catch (storefrontError) {
        console.error('❌ Both APIs failed:', { adminError: adminError.message, storefrontError: storefrontError.message });
        console.error('❌ Storefront API error details:', storefrontError);
        throw new Error(`Both Admin API and Storefront API failed. Admin: ${adminError.message}, Storefront: ${storefrontError.message}`);
      }
    }

    console.log('✅ Returning successful response:', {
      cartId: response.cartId,
      subtotal: response.subtotal.amount,
      total: response.total.amount,
      lineItemsCount: response.lineItems.length
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Checkout calculation error:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to calculate checkout', details: error.message },
      { status: 500 }
    );
  }
} 