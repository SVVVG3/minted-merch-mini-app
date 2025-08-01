import { kv } from '@/lib/kv';
import { createOrder as createShopifyOrder } from './shopify';
import { createOrder as createSupabaseOrder } from './orders';

const BASE_RPC_URL = process.env.BASE_RPC_URL;
const PAYMENT_RECIPIENT_ADDRESS = process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS;
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export async function verifyTransaction(transactionHash, expectedAmount) {
  // Get transaction details from Alchemy
  const txResponse = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionByHash',
      params: [transactionHash],
      id: 1
    })
  });

  const txData = await txResponse.json();
  
  if (!txData.result) {
    throw new Error('Transaction not found');
  }

  const transaction = txData.result;

  // Verify it's to the USDC contract
  if (transaction.to.toLowerCase() !== USDC_CONTRACT_ADDRESS.toLowerCase()) {
    throw new Error('Transaction is not a USDC transfer');
  }

  // Get transaction receipt to ensure it was successful
  const receiptResponse = await fetch(BASE_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [transactionHash],
      id: 1
    })
  });

  const receiptData = await receiptResponse.json();
  
  if (!receiptData.result || receiptData.result.status !== '0x1') {
    throw new Error('Transaction failed or not confirmed');
  }

  // Decode the transaction input
  const input = transaction.input;
  
  // ERC20 transfer method ID: 0xa9059cbb
  if (!input.startsWith('0xa9059cbb')) {
    throw new Error('Transaction is not a transfer');
  }

  // Extract recipient and amount
  const recipientHex = '0x' + input.slice(34, 74);
  const recipient = '0x' + recipientHex.slice(-40);
  const amountHex = '0x' + input.slice(74, 138);
  const amount = parseInt(amountHex, 16);

  // Convert expected amount to USDC decimals
  const expectedAmountInDecimals = Math.floor(parseFloat(expectedAmount) * 1e6);

  // Verify recipient
  if (recipient.toLowerCase() !== PAYMENT_RECIPIENT_ADDRESS.toLowerCase()) {
    throw new Error('Invalid recipient address');
  }

  // Verify amount (allow small tolerance)
  if (Math.abs(amount - expectedAmountInDecimals) > 1) {
    throw new Error('Invalid payment amount');
  }

  return {
    from: transaction.from,
    recipient: recipient,
    amount: amount / 1e6,
    blockNumber: receiptData.result.blockNumber
  };
}

export async function createOrderFromSession(sessionId, transactionHash) {
  // Get session data
  const sessionKey = `order_session:${sessionId}`;
  const sessionData = await kv.get(sessionKey);
  
  if (!sessionData) {
    throw new Error('Invalid or expired order session');
  }

  // Check if transaction was already used
  const existingOrder = await kv.get(`tx:${transactionHash}`);
  if (existingOrder) {
    throw new Error('Transaction already used for another order');
  }

  // Verify the transaction
  const txDetails = await verifyTransaction(transactionHash, sessionData.amount);

  // Create the order in Shopify
  const order = await createShopifyOrder({
    lineItems: sessionData.lineItems,
    customer: sessionData.customer,
    shippingAddress: sessionData.shippingAddress,
    transactionHash
  });

  // Create order in Supabase database for notifications and tracking
  try {
    const supabaseOrderData = {
      fid: sessionData.fid, // Should be included in session data
      orderId: order.name, // Use Shopify order name as our order ID
      sessionId: sessionId,
      status: 'paid', // Payment is verified at this point
      currency: 'USDC',
      amountTotal: parseFloat(order.totalPriceSet.shopMoney.amount),
      amountSubtotal: parseFloat(order.subtotalPriceSet?.shopMoney?.amount || order.totalPriceSet.shopMoney.amount),
      amountTax: parseFloat(order.totalTaxSet?.shopMoney?.amount || '0'),
      amountShipping: parseFloat(order.totalShippingPriceSet?.shopMoney?.amount || '0'),
      customerEmail: sessionData.customer.email,
      customerName: sessionData.customer.firstName ? 
        `${sessionData.customer.firstName} ${sessionData.customer.lastName || ''}`.trim() : 
        sessionData.customer.email,
      shippingAddress: sessionData.shippingAddress,
      shippingMethod: sessionData.shippingMethod || 'Standard',
      lineItems: sessionData.lineItems.map(item => ({
        id: item.variantId,
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price),
        variant: item.variantTitle
      })),
      paymentMethod: 'USDC',
      paymentStatus: 'completed',
      paymentIntentId: transactionHash
    };

    const supabaseResult = await createSupabaseOrder(supabaseOrderData);
    
    if (supabaseResult.success) {
      console.log('✅ Order created in Supabase:', supabaseResult.order.order_id);
      
      // Send order confirmation notification since order status is 'paid'
      try {
        const { sendOrderConfirmationNotificationAndMark } = await import('./orders');
        await sendOrderConfirmationNotificationAndMark(supabaseResult.order);
        console.log('✅ Order confirmation notification sent');
      } catch (notificationError) {
        console.error('❌ Failed to send order confirmation notification:', notificationError);
        // Don't fail the order creation, just log the error
      }
    } else {
      console.error('❌ Failed to create order in Supabase:', supabaseResult.error);
      // Don't fail the entire order creation, just log the error
    }
  } catch (error) {
    console.error('❌ Error creating Supabase order:', error);
    // Don't fail the entire order creation, just log the error
  }

  // Store transaction hash with order details
  await kv.set(`tx:${transactionHash}`, {
    orderId: order.id,
    orderName: order.name,
    amount: order.totalPriceSet.shopMoney.amount,
    timestamp: Date.now(),
    customerEmail: sessionData.customer.email
  });

  // Store order ID mapping
  await kv.set(`order:${order.id}`, {
    transactionHash,
    timestamp: Date.now()
  });

  // Delete the session
  await kv.del(sessionKey);

  return order;
}