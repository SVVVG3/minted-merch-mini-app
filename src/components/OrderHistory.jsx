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
      
      const response = await fetch(`/api/user-orders?fid=${userFid}&limit=50&includeArchived=true`);
      
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl drop-shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Order History</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats Summary */}
        {!isLoading && orders.length > 0 && (
          <div className="p-4 bg-gray-50 border-b">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[#3eb489]">{stats.totalOrders}</div>
                <div className="text-xs text-gray-600">Total Orders</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#3eb489]">${stats.totalSpent.toFixed(2)}</div>
                <div className="text-xs text-gray-600">Total Spent</div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#3eb489] border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading order history...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading orders</h3>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <button
                onClick={loadOrderHistory}
                className="text-[#3eb489] hover:text-[#2d8659] text-sm font-medium"
              >
                Try again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-600 text-sm">Your order history will appear here after you make your first purchase.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {orders.map((order, index) => {
                // Clean order ID for display (remove # if present)
                const cleanOrderId = order.order_id?.replace('#', '') || order.orderId?.replace('#', '') || 'Unknown';
                const orderUrl = `/order/${cleanOrderId}`;
                
                return (
                  <div key={order.id || order.order_id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <button
                          className="font-medium text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = orderUrl;
                          }}
                        >
                          Order #{cleanOrderId}
                        </button>
                        <div className="text-xs text-gray-600">{new Date(order.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">${parseFloat(order.amount_total || 0).toFixed(2)} {order.currency || 'USDC'}</div>
                        <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                          formatStatus(order.status) === 'Confirmed' || formatStatus(order.status) === 'confirmed' 
                            ? 'bg-green-100 text-green-800'
                            : formatStatus(order.status) === 'Shipped' || formatStatus(order.status) === 'shipped'
                            ? 'bg-blue-100 text-blue-800' 
                            : formatStatus(order.status) === 'Delivered' || formatStatus(order.status) === 'delivered'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {formatStatus(order.status)}
                        </div>
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

                    {/* Transaction Hash (if available) */}
                    {order.payment_intent_id && (
                      <div className="text-xs text-gray-500 mt-1">
                        <span>Tx: </span>
                        <button
                          className="text-blue-600 hover:text-blue-800 underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTransaction(order.payment_intent_id);
                          }}
                        >
                          {order.payment_intent_id.slice(0, 10)}...{order.payment_intent_id.slice(-8)}
                        </button>
                      </div>
                    )}

                    {/* Discount info (if applicable) */}
                    {order.discount_code && (
                      <div className="text-xs text-green-600 mt-1">
                        Discount: {order.discount_code} (-${order.discount_amount?.toFixed(2) || '0.00'})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 