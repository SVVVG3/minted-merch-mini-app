const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
  console.error('Missing Shopify Admin environment variables:', {
    SHOPIFY_DOMAIN: !!SHOPIFY_DOMAIN,
    SHOPIFY_ADMIN_ACCESS_TOKEN: !!SHOPIFY_ADMIN_ACCESS_TOKEN
  });
}

const SHOPIFY_ADMIN_API_URL = `https://${SHOPIFY_DOMAIN}.myshopify.com/admin/api/2024-10/graphql.json`;

export async function shopifyAdminFetch(query, variables = {}) {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
    throw new Error('Missing Shopify Admin environment variables. Please check SHOPIFY_SITE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN.');
  }

  console.log('Shopify Admin API URL:', SHOPIFY_ADMIN_API_URL);
  console.log('Admin Access Token available:', !!SHOPIFY_ADMIN_ACCESS_TOKEN);
  
  const response = await fetch(SHOPIFY_ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  console.log('Shopify Admin API Response Status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shopify Admin API Error Response:', errorText);
    throw new Error(`Shopify Admin API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Shopify Admin API Response:', JSON.stringify(data, null, 2));
  
  if (data.errors) {
    console.error('Shopify Admin API GraphQL Errors:', data.errors);
    throw new Error(`Shopify Admin API GraphQL error: ${data.errors[0].message}`);
  }

  return data;
}

// Create order in Shopify with payment marked as paid
export async function createShopifyOrder(orderData) {
  const {
    lineItems,
    shippingAddress,
    billingAddress,
    customer,
    totalPrice,
    subtotalPrice,
    totalTax,
    shippingLines,
    transactionHash,
    notes = '',
    userFid
  } = orderData;

  const mutation = `
    mutation orderCreate($order: OrderCreateOrderInput!) {
      orderCreate(order: $order) {
        order {
          id
          name
          email
          phone
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
          shippingAddress {
            firstName
            lastName
            address1
            city
            province
            zip
            country
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variant {
                  id
                  title
                }
              }
            }
          }
          displayFulfillmentStatus
          displayFinancialStatus
          createdAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    order: {
      lineItems: lineItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        priceSet: {
          shopMoney: {
            amount: item.price.toString(),
            currencyCode: 'USD'
          }
        }
      })),
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        province: shippingAddress.province,
        zip: shippingAddress.zip,
        country: shippingAddress.country,
        phone: shippingAddress.phone || ''
      },
      billingAddress: billingAddress ? {
        firstName: billingAddress.firstName,
        lastName: billingAddress.lastName,
        address1: billingAddress.address1,
        address2: billingAddress.address2 || '',
        city: billingAddress.city,
        province: billingAddress.province,
        zip: billingAddress.zip,
        country: billingAddress.country,
        phone: billingAddress.phone || ''
      } : {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        province: shippingAddress.province,
        zip: shippingAddress.zip,
        country: shippingAddress.country,
        phone: shippingAddress.phone || ''
      },
      email: customer.email || '',
      phone: customer.phone || shippingAddress.phone || '',
      note: notes ? `${notes}\n\nPaid with USDC on Base Network\nTransaction Hash: ${transactionHash}${userFid ? `\nFarcaster FID: ${userFid}` : ''}` : `Paid with USDC on Base Network\nTransaction Hash: ${transactionHash}${userFid ? `\nFarcaster FID: ${userFid}` : ''}`,
      shippingLines: shippingLines ? [{
        title: shippingLines.title,
        priceSet: {
          shopMoney: {
            amount: shippingLines.price.toString(),
            currencyCode: 'USD'
          }
        },
        code: shippingLines.code || shippingLines.title
      }] : [],
      transactions: [{
        kind: 'SALE',
        status: 'SUCCESS',
        amountSet: {
          shopMoney: {
            amount: totalPrice.toString(),
            currencyCode: 'USD'
          }
        },
        gateway: 'USDC Base Network'
      }]
    }
  };

  console.log('Creating order with variables:', JSON.stringify(variables, null, 2));
  
  try {
    const response = await shopifyAdminFetch(mutation, variables);
    
    console.log('Shopify orderCreate response:', JSON.stringify(response, null, 2));
    
    if (response.data.orderCreate.userErrors.length > 0) {
      console.error('Order creation errors:', response.data.orderCreate.userErrors);
      throw new Error(`Order creation failed: ${response.data.orderCreate.userErrors[0].message}`);
    }

    const order = response.data.orderCreate.order;
    
    if (!order) {
      console.error('Order creation returned null order');
      throw new Error('Order creation failed: Shopify returned null order');
    }
    
    console.log('Order created successfully:', order.name, order.id);
    
    return {
      success: true,
      order: {
        id: order.id,
        name: order.name,
        totalPrice: order.totalPriceSet.shopMoney.amount,
        financialStatus: order.displayFinancialStatus,
        fulfillmentStatus: order.displayFulfillmentStatus,
        createdAt: order.createdAt,
        shippingAddress: order.shippingAddress,
        lineItems: order.lineItems.edges.map(edge => edge.node)
      }
    };
  } catch (error) {
    console.error('Error creating Shopify order:', error);
    throw error;
  }
}

// Get order status by ID
export async function getOrderStatus(orderId) {
  const query = `
    query getOrder($id: ID!) {
      order(id: $id) {
        id
        name
        financialStatus
        fulfillmentStatus
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        createdAt
        updatedAt
      }
    }
  `;

  try {
    const response = await shopifyAdminFetch(query, { id: orderId });
    return response.data.order;
  } catch (error) {
    console.error('Error fetching order status:', error);
    throw error;
  }
}

// Mark order as fulfilled (when shipped)
export async function fulfillOrder(orderId, trackingNumber = null, trackingCompany = null) {
  const mutation = `
    mutation fulfillmentCreate($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment {
          id
          status
          trackingInfo {
            number
            company
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    fulfillment: {
      orderId: orderId,
      trackingInfo: trackingNumber ? {
        number: trackingNumber,
        company: trackingCompany || 'Other'
      } : null
    }
  };

  try {
    const response = await shopifyAdminFetch(mutation, variables);
    
    if (response.data.fulfillmentCreate.userErrors.length > 0) {
      throw new Error(`Fulfillment failed: ${response.data.fulfillmentCreate.userErrors[0].message}`);
    }

    return response.data.fulfillmentCreate.fulfillment;
  } catch (error) {
    console.error('Error fulfilling order:', error);
    throw error;
  }
} 