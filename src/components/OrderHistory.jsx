'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';

export function OrderHistory({ isOpen, onClose }) {
  const { getFid } = useFarcaster();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ totalOrders: 0, totalSpent: 0, lastOrderDate: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get the FID value once to avoid infinite loops
  const userFid = getFid();

  const loadOrderHistory = useCallback(async () => {
    if (!userFid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📡 Loading order history for FID:', userFid);
      
      const response = await fetch(`/api/user-orders?fid=${userFid}&limit=50`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📦 Order history API response:', data);
      
      if (data.orders && Array.isArray(data.orders)) {
        setOrders(data.orders);
        setStats({
          totalOrders: data.totalOrders || data.orders.length,
          totalSpent: data.totalSpent || 0,
          lastOrderDate: data.lastOrderDate
        });
      } else {
        console.log('📝 No orders found');
        setOrders([]);
        setStats({ totalOrders: 0, totalSpent: 0, lastOrderDate: null });
      }
    } catch (error) {
      console.error('❌ Failed to load order history:', error);
      setError(error.message);
      setOrders([]);
      setStats({ totalOrders: 0, totalSpent: 0, lastOrderDate: null });
    } finally {
      setIsLoading(false);
    }
  }, [userFid]);

  useEffect(() => {
    if (isOpen && userFid) {
      loadOrderHistory();
    }
  }, [isOpen, userFid, loadOrderHistory]);

  // Helper function to format status
  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    
    const statusMap = {
      'pending': 'Pending',
      'paid': 'Confirmed', 
      'processing': 'Processing',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled',
      'refunded': 'Refunded'
    };
    
    return statusMap[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Helper function to handle transaction link opening
  const handleOpenTransaction = async (transactionHash) => {
    if (!transactionHash) return;
    
    try {
      const baseScanUrl = `https://basescan.org/tx/${transactionHash}`;
      console.log('🔗 Opening transaction:', baseScanUrl);
      
      // Use the proper Farcaster SDK method
      await sdk.actions.openUrl(baseScanUrl);
    } catch (error) {
      console.log('SDK openUrl failed, trying fallback methods:', error);
      
      // Fallback methods
      try {
        if (window.open) {
          window.open(baseScanUrl, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = baseScanUrl;
        }
      } catch (fallbackError) {
        console.error('All methods failed to open transaction link:', fallbackError);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Order History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading orders...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-2">Failed to load orders</p>
              <p className="text-sm text-gray-500">{error}</p>
              <button
                onClick={loadOrderHistory}
                className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Retry
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No orders found</p>
              <p className="text-sm text-gray-500 mt-1">Your order history will appear here</p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Orders</span>
                    <p className="font-semibold">{stats.totalOrders}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Spent</span>
                    <p className="font-semibold">${stats.totalSpent.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Orders List */}
              <div className="space-y-4">
                {orders.map((order) => {
                  // Clean order ID for display (remove # if present)
                  const cleanOrderId = order.order_id?.replace('#', '') || order.orderId?.replace('#', '') || 'Unknown';
                  const orderUrl = `/order/${cleanOrderId}`;
                  
                  return (
                    <div key={order.id || order.order_id} className="border rounded-lg p-3">
                      {/* Order Header */}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <a
                            href={orderUrl}
                            className="font-medium text-purple-600 hover:text-purple-800 text-sm"
                          >
                            Order #{cleanOrderId}
                          </a>
                          <p className="text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            ${parseFloat(order.amount_total || 0).toFixed(2)}
                          </p>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                            formatStatus(order.status) === 'Shipped' 
                              ? 'bg-green-100 text-green-800'
                              : formatStatus(order.status) === 'Confirmed'
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {formatStatus(order.status)}
                          </span>
                        </div>
                      </div>

                      {/* Order Items Preview */}
                      {order.lineItems && order.lineItems.length > 0 && (
                        <div className="text-xs text-gray-600">
                          {order.lineItems.length === 1 
                            ? `1 item`
                            : `${order.lineItems.length} items`
                          }
                          {order.lineItems.length <= 3 ? (
                            <span className="ml-1">
                              ({order.lineItems.map((item, idx) => {
                                // Use the enriched title from the API
                                let itemName = item.title || 'Unknown Item';
                                
                                // Include variant info if available
                                if (item.variant && item.variant !== 'Default Title') {
                                  itemName += ` (${item.variant})`;
                                }
                                
                                return itemName;
                              }).join(', ')})
                            </span>
                          ) : (
                            <span className="ml-1">
                              ({order.lineItems.slice(0, 2).map((item, idx) => {
                                let itemName = item.title || 'Unknown Item';
                                if (item.variant && item.variant !== 'Default Title') {
                                  itemName += ` (${item.variant})`;
                                }
                                return itemName;
                              }).join(', ')} and {order.lineItems.length - 2} more)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        <a
                          href={orderUrl}
                          className="flex-1 text-center px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                        >
                          View Details
                        </a>
                        
                        {order.payment_intent_id && (
                          <button
                            onClick={() => handleOpenTransaction(order.payment_intent_id)}
                            className="flex-1 text-center px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                          >
                            View Transaction
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 