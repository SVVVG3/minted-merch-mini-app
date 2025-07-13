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

// Consume/debit gift card balance in Shopify
export async function debitGiftCard(giftCardCode, amount) {
  console.log('🎁 Debiting gift card:', { code: giftCardCode, amount });
  
  try {
    // First, get the gift card details to find its Shopify ID
    const shopDomain = process.env.SHOPIFY_SITE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    
    // Get gift card by code
    const getGiftCardUrl = `https://${shopDomain}.myshopify.com/admin/api/2024-10/gift_cards.json?code=${giftCardCode.toUpperCase()}`;
    
    const getResponse = await fetch(getGiftCardUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!getResponse.ok) {
      throw new Error(`Failed to fetch gift card: ${getResponse.status}`);
    }
    
    const giftCardData = await getResponse.json();
    
    if (!giftCardData.gift_cards || giftCardData.gift_cards.length === 0) {
      throw new Error('Gift card not found');
    }
    
    const giftCard = giftCardData.gift_cards[0];
    const giftCardId = giftCard.id;
    const currentBalance = parseFloat(giftCard.balance);
    
    console.log('🎁 Gift card found:', {
      id: giftCardId,
      currentBalance,
      requestedAmount: amount
    });
    
    // Check if sufficient balance
    if (currentBalance < amount) {
      throw new Error(`Insufficient gift card balance. Available: $${currentBalance}, Requested: $${amount}`);
    }
    
    // Create a gift card debit transaction
    const debitData = {
      debit: {
        amount: amount.toString(),
        note: `Used in order payment - Minted Merch Mini App`
      }
    };
    
    const debitUrl = `https://${shopDomain}.myshopify.com/admin/api/2024-10/gift_cards/${giftCardId}/debits.json`;
    
    const debitResponse = await fetch(debitUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(debitData)
    });
    
    if (!debitResponse.ok) {
      const errorText = await debitResponse.text();
      throw new Error(`Failed to debit gift card: ${debitResponse.status} - ${errorText}`);
    }
    
    const debitResult = await debitResponse.json();
    
    console.log('✅ Gift card debited successfully:', {
      giftCardId,
      amountDebited: amount,
      balanceAfter: currentBalance - amount,
      debitId: debitResult.debit?.id
    });
    
    return {
      success: true,
      giftCardId,
      amountDebited: amount,
      balanceAfter: currentBalance - amount,
      debitId: debitResult.debit?.id
    };
    
  } catch (error) {
    console.error('❌ Error debiting gift card:', error);
    return {
      success: false,
      error: error.message
    };
  }
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
      note: (() => {
        let orderNotes = notes ? `${notes}\n\n` : '';
        
        // Add payment information
        orderNotes += `Paid with USDC on Base Network\nTransaction Hash: ${transactionHash}`;
        
        // Add Farcaster FID if available
        if (userFid) {
          orderNotes += `\nFarcaster FID: ${userFid}`;
        }
        
        // Add gift card information if present
        if (orderData.giftCards && Array.isArray(orderData.giftCards) && orderData.giftCards.length > 0) {
          const usedGiftCards = orderData.giftCards.filter(gc => gc.code && parseFloat(gc.amountUsed || 0) > 0);
          if (usedGiftCards.length > 0) {
            orderNotes += '\n\n--- GIFT CARDS USED ---';
            usedGiftCards.forEach(gc => {
              orderNotes += `\nGift Card: ${gc.code} - Amount Used: $${parseFloat(gc.amountUsed).toFixed(2)}`;
              if (gc.balanceAfter !== undefined) {
                orderNotes += ` (Balance After: $${parseFloat(gc.balanceAfter).toFixed(2)})`;
              }
            });
            const totalGiftCardUsed = usedGiftCards.reduce((sum, gc) => sum + parseFloat(gc.amountUsed || 0), 0);
            orderNotes += `\nTotal Gift Card Amount: $${totalGiftCardUsed.toFixed(2)}`;
          }
        }
        
        return orderNotes;
      })(),
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
      transactions: (() => {
        const transactions = [];
        
        // Calculate USDC payment amount (total minus gift cards)
        let usdcAmount = totalPrice;
        let totalGiftCardAmount = 0;
        
        // Add gift card transactions if present
        if (orderData.giftCards && Array.isArray(orderData.giftCards) && orderData.giftCards.length > 0) {
          console.log('🔍 Processing gift cards for transactions:', {
            giftCardsCount: orderData.giftCards.length,
            giftCardsData: orderData.giftCards.map(gc => ({
              hasCode: !!gc.code,
              code: gc.code,
              hasAmountUsed: !!gc.amountUsed,
              amountUsed: gc.amountUsed,
              balanceAfter: gc.balanceAfter
            }))
          });
          
          orderData.giftCards.forEach(giftCard => {
            console.log('🎁 Processing individual gift card:', {
              hasCode: !!giftCard.code,
              code: giftCard.code,
              hasAmountUsed: !!giftCard.amountUsed,
              amountUsed: giftCard.amountUsed,
              amountUsedParsed: parseFloat(giftCard.amountUsed || 0),
              willProcessTransaction: !!(giftCard.code && parseFloat(giftCard.amountUsed || 0) > 0)
            });
            
            if (giftCard.code && parseFloat(giftCard.amountUsed || 0) > 0) {
              const giftCardAmount = parseFloat(giftCard.amountUsed);
              totalGiftCardAmount += giftCardAmount;
              
              // Add gift card transaction
              transactions.push({
                kind: 'SALE',
                status: 'SUCCESS',
                amountSet: {
                  shopMoney: {
                    amount: giftCardAmount.toString(),
                    currencyCode: 'USD'
                  }
                },
                gateway: `Gift Card (${giftCard.code})`,
                paymentDetails: {
                  giftCardCode: giftCard.code
                }
              });
            }
          });
          
          // Adjust USDC amount
          usdcAmount = Math.max(0.01, totalPrice - totalGiftCardAmount); // Minimum $0.01 for processing
        }
        
        // Add USDC transaction for remaining amount
        if (usdcAmount > 0) {
          transactions.push({
            kind: 'SALE',
            status: 'SUCCESS',
            amountSet: {
              shopMoney: {
                amount: usdcAmount.toString(),
                currencyCode: 'USD'
              }
            },
            gateway: 'USDC Base Network'
          });
        }
        
        console.log('💳 Created transactions:', {
          totalOrderAmount: totalPrice,
          totalGiftCardAmount,
          usdcAmount,
          transactionCount: transactions.length,
          transactions: transactions.map(t => ({
            amount: t.amountSet.shopMoney.amount,
            gateway: t.gateway
          }))
        });
        
        return transactions;
      })()
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
    
    // Consume gift cards after successful order creation
    if (orderData.giftCards && Array.isArray(orderData.giftCards) && orderData.giftCards.length > 0) {
      console.log('🎁 Processing gift card consumption for order:', order.name, {
        giftCardsCount: orderData.giftCards.length,
        giftCardsData: orderData.giftCards.map(gc => ({
          hasCode: !!gc.code,
          code: gc.code,
          hasAmountUsed: !!gc.amountUsed,
          amountUsed: gc.amountUsed
        }))
      });
      
      for (const giftCard of orderData.giftCards) {
        console.log('🔍 Checking gift card for consumption:', {
          hasCode: !!giftCard.code,
          code: giftCard.code,
          hasAmountUsed: !!giftCard.amountUsed,
          amountUsed: giftCard.amountUsed,
          amountUsedParsed: parseFloat(giftCard.amountUsed || 0),
          willConsume: !!(giftCard.code && parseFloat(giftCard.amountUsed || 0) > 0)
        });
        
        if (giftCard.code && parseFloat(giftCard.amountUsed || 0) > 0) {
          try {
            const debitResult = await debitGiftCard(giftCard.code, parseFloat(giftCard.amountUsed));
            
            if (debitResult.success) {
              console.log('✅ Gift card consumed successfully:', {
                code: giftCard.code,
                amountUsed: giftCard.amountUsed,
                newBalance: debitResult.balanceAfter
              });
            } else {
              console.error('❌ Failed to consume gift card:', {
                code: giftCard.code,
                error: debitResult.error
              });
              // Note: We don't fail the order creation if gift card consumption fails
              // The order is already created in Shopify, we just log the error
            }
          } catch (giftCardError) {
            console.error('❌ Error consuming gift card:', {
              code: giftCard.code,
              error: giftCardError.message
            });
            // Note: We don't fail the order creation if gift card consumption fails
          }
        }
      }
    }
    
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