'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { getUserOrderHistory, clearUserOrderHistory, getOrderHistoryStats } from '@/lib/orderHistory';

export function OrderHistory({ isOpen, onClose }) {
  const { getFid } = useFarcaster();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ totalOrders: 0, totalSpent: 0, lastOrderDate: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && getFid()) {
      loadOrderHistory();
    }
  }, [isOpen, getFid]);

  const loadOrderHistory = () => {
    setIsLoading(true);
    try {
      const userFid = getFid();
      const orderHistory = getUserOrderHistory(userFid);
      const orderStats = getOrderHistoryStats(userFid);
      
      setOrders(orderHistory);
      setStats(orderStats);
    } catch (error) {
      console.error('Error loading order history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your order history? This cannot be undone.')) {
      const userFid = getFid();
      clearUserOrderHistory(userFid);
      setOrders([]);
      setStats({ totalOrders: 0, totalSpent: 0, lastOrderDate: null });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        
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
              {orders.map((order, index) => (
                <div key={order.name || index} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">Order {order.name}</div>
                      <div className="text-xs text-gray-600">{formatDate(order.timestamp)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">${order.total?.amount} {order.total?.currencyCode}</div>
                      <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                        order.status === 'Confirmed' || order.status === 'confirmed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status || 'Confirmed'}
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
                          ({order.lineItems.map(item => {
                            const itemName = item.title || item.name || 'Unknown Item';
                            const variant = item.variantTitle ? ` (${item.variantTitle})` : '';
                            return `${itemName}${variant}`;
                          }).join(', ')})
                        </span>
                      ) : (
                        <span className="ml-1">
                          ({order.lineItems[0].title || 'Unknown Item'} and {order.lineItems.length - 1} more)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Transaction Hash (if available) */}
                  {order.transactionHash && (
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      Tx: {order.transactionHash.slice(0, 10)}...{order.transactionHash.slice(-8)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && orders.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleClearHistory}
              className="w-full text-sm text-red-600 hover:text-red-700 py-2"
            >
              Clear Order History
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 