const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
  throw new Error('Missing Shopify environment variables');
}

const SHOPIFY_API_URL = `https://${SHOPIFY_DOMAIN}.myshopify.com/api/2024-07/graphql.json`;

async function shopifyFetch(query, variables = {}) {
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
    throw new Error(data.errors[0].message);
  }

  return data.data;
}

export async function getCollections() {
  const query = `
    query {
      collections(first: 10) {
        edges {
          node {
            id
            title
            handle
            updatedAt
          }
        }
      }
    }
  `;

  const data = await shopifyFetch(query);
  return data.collections.edges.map(edge => edge.node);
}

export async function getCollectionByHandle(handle) {
  const query = `
    query getCollection($handle: String!) {
      collection(handle: $handle) {
        id
        title
        handle
        description
        products(first: 20) {
          edges {
            node {
              id
              title
              handle
              description
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch(query, { handle });
  return data.collection;
}

export async function getProductByHandle(handle) {
  const query = `
    query getProduct($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        handle
        description
        descriptionHtml
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        images(first: 5) {
          edges {
            node {
              url
              altText
            }
          }
        }
        variants(first: 10) {
          edges {
            node {
              id
              title
              availableForSale
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch(query, { handle });
  return data.productByHandle;
}

export async function createCheckout(email, address) {
  const query = `
    mutation checkoutCreate($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) {
        checkout {
          id
          webUrl
          totalPrice {
            amount
            currencyCode
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = {
    email,
    shippingAddress: address,
  };

  const data = await shopifyFetch(query, { input });
  
  if (data.checkoutCreate.userErrors.length > 0) {
    throw new Error(data.checkoutCreate.userErrors[0].message);
  }

  return data.checkoutCreate.checkout;
}

export async function addLineItem(checkoutId, variantId, quantity = 1) {
  const query = `
    mutation checkoutLineItemsAdd($checkoutId: ID!, $lineItems: [CheckoutLineItemInput!]!) {
      checkoutLineItemsAdd(checkoutId: $checkoutId, lineItems: $lineItems) {
        checkout {
          id
          webUrl
          totalPrice {
            amount
            currencyCode
          }
          lineItems(first: 20) {
            edges {
              node {
                title
                quantity
                variant {
                  priceV2 {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const lineItems = [{ variantId, quantity }];

  const data = await shopifyFetch(query, { checkoutId, lineItems });
  
  if (data.checkoutLineItemsAdd.userErrors.length > 0) {
    throw new Error(data.checkoutLineItemsAdd.userErrors[0].message);
  }

  return data.checkoutLineItemsAdd.checkout;
}

// Client-side function to calculate checkout totals via API
export async function calculateCheckout(cartItems, shippingAddress, email = null) {
  try {
    const response = await fetch('/api/shopify/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartItems,
        shippingAddress,
        email
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to calculate checkout');
    }

    return data;
  } catch (error) {
    console.error('Checkout calculation error:', error);
    throw error;
  }
}

export async function createOrder({ lineItems, customer, shippingAddress, transactionHash }) {
  const query = `
    mutation orderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) {
        userErrors {
          field
          message
        }
        order {
          id
          name
          displayFinancialStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            email
            firstName
            lastName
          }
        }
      }
    }
  `;

  const variables = {
    order: {
      lineItems: lineItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity
      })),
      customer: {
        toUpsert: {
          email: customer.email,
          firstName: customer.firstName || '',
          lastName: customer.lastName || ''
        }
      },
      shippingAddress: {
        address1: shippingAddress.address1,
        city: shippingAddress.city,
        province: shippingAddress.province,
        country: shippingAddress.country || 'US',
        zip: shippingAddress.zip
      },
      financialStatus: 'PAID',
      note: `USDC Transaction Hash: ${transactionHash}`,
      customAttributes: [
        {
          key: 'transaction_hash',
          value: transactionHash
        },
        {
          key: 'payment_method',
          value: 'USDC on Base'
        },
        {
          key: 'source',
          value: 'farcaster-mini-app'
        }
      ],
      tags: ['farcaster-mini-app', 'usdc-payment']
    },
    options: {
      sendReceipt: true,
      sendOrderFulfillmentReceipt: true,
      inventoryBehaviour: 'DECREMENT_OBEYING_POLICY'
    }
  };

  const data = await shopifyFetch(query, variables);
  
  if (data.orderCreate.userErrors.length > 0) {
    throw new Error(data.orderCreate.userErrors[0].message);
  }

  return data.orderCreate.order;
}