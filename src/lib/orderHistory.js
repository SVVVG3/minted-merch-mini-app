'use client';

/**
 * Order History Management
 * Stores order history in localStorage, keyed by user's Farcaster FID
 */

const ORDER_HISTORY_KEY = 'mintedmerch-order-history';

export function saveOrderToHistory(userFid, orderDetails) {
  if (!userFid || !orderDetails) {
    console.warn('Cannot save order: missing userFid or orderDetails');
    return;
  }

  try {
    // Get existing order history
    const existingHistory = localStorage.getItem(ORDER_HISTORY_KEY);
    const allOrderHistory = existingHistory ? JSON.parse(existingHistory) : {};
    
    // Get user's order history
    const userOrderHistory = allOrderHistory[userFid] || [];
    
    // Create order record
    const orderRecord = {
      ...orderDetails,
      timestamp: new Date().toISOString(),
      saved: true
    };
    
    // Add to beginning of array (most recent first)
    userOrderHistory.unshift(orderRecord);
    
    // Keep only last 20 orders per user
    if (userOrderHistory.length > 20) {
      userOrderHistory.splice(20);
    }
    
    // Update user's history
    allOrderHistory[userFid] = userOrderHistory;
    
    // Save back to localStorage
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(allOrderHistory));
    
    console.log('Order saved to history:', orderRecord.name);
  } catch (error) {
    console.error('Error saving order to history:', error);
    // In Mini App environments, localStorage might be restricted
  }
}

export function getUserOrderHistory(userFid) {
  if (!userFid) {
    return [];
  }

  try {
    const existingHistory = localStorage.getItem(ORDER_HISTORY_KEY);
    const allOrderHistory = existingHistory ? JSON.parse(existingHistory) : {};
    return allOrderHistory[userFid] || [];
  } catch (error) {
    console.error('Error loading order history:', error);
    return [];
  }
}

export function clearUserOrderHistory(userFid) {
  if (!userFid) {
    return;
  }

  try {
    const existingHistory = localStorage.getItem(ORDER_HISTORY_KEY);
    const allOrderHistory = existingHistory ? JSON.parse(existingHistory) : {};
    
    // Remove user's history
    delete allOrderHistory[userFid];
    
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(allOrderHistory));
    console.log('Order history cleared for user:', userFid);
  } catch (error) {
    console.error('Error clearing order history:', error);
  }
}

export function getOrderHistoryStats(userFid) {
  const orders = getUserOrderHistory(userFid);
  
  return {
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, order) => {
      // Parse total amount from order details
      const amount = parseFloat(order.total?.amount || 0);
      return sum + amount;
    }, 0),
    lastOrderDate: orders.length > 0 ? orders[0].timestamp : null
  };
} 