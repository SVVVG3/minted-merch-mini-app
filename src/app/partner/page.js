'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PartnerProvider, usePartner } from '@/lib/PartnerContext';

function PartnerDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(null);
  const { partner, isAuthenticated, loading: authLoading, logout } = usePartner();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/partner/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load orders when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadOrders();
    }
  }, [isAuthenticated]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/partner/orders', {
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setOrders(result.data);
        setError('');
      } else {
        setError(result.error || 'Failed to load orders');
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderUpdate = async (orderId, updateData) => {
    try {
      setUpdating(orderId);
      const response = await fetch(`/api/partner/orders/${encodeURIComponent(orderId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh orders
        await loadOrders();
        // Close modal if open
        if (selectedOrder && selectedOrder.order_id === orderId) {
          setSelectedOrder(null);
        }
        alert('Order updated successfully!');
      } else {
        alert(result.error || 'Failed to update order');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order');
    } finally {
      setUpdating(null);
    }
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      router.push('/partner/login');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned': return 'bg-orange-100 text-orange-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-green-100 text-green-800';
      case 'vendor_paid': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6">
            {/* Logo and Title Row */}
            <div className="flex items-center justify-between mb-3 sm:mb-0">
              <div className="flex items-center space-x-3">
                <img 
                  src="/MintedMerchSpinnerLogo.png" 
                  alt="Minted Merch"
                  className="h-8 w-auto"
                />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Partner Dashboard</h1>
              </div>
              {/* Logout button on mobile, hidden on desktop */}
              <button
                onClick={handleLogout}
                className="sm:hidden bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md text-sm"
              >
                Logout
              </button>
            </div>
            {/* Welcome and Logout Row - Mobile: stacked, Desktop: right-aligned */}
            <div className="flex flex-col sm:flex-row sm:justify-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{partner?.name}</span>
              </div>
              {/* Logout button on desktop, hidden on mobile */}
              <button
                onClick={handleLogout}
                className="hidden sm:block bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Your Assigned Orders</h2>
            <button
              onClick={loadOrders}
              className="bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
            >
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">Loading orders...</div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <div className="text-red-600">{error}</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">No orders assigned to you yet.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shipping Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.order_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.order_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {(() => {
                          // Debug: log the shipping address structure
                          console.log('Shipping address for order', order.order_id, ':', order.shipping_address);
                          
                          if (order.shipping_address) {
                            return (
                              <div>
                                <div className="font-medium">{order.shipping_address.name}</div>
                                <div className="text-xs text-gray-500">
                                  {order.shipping_address.address_line_1}
                                  {order.shipping_address.address_line_2 && `, ${order.shipping_address.address_line_2}`}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {order.shipping_address.country}
                                </div>
                              </div>
                            );
                          } else {
                            return <div className="text-gray-500 text-xs">No address</div>;
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status === 'vendor_paid' ? 'Vendor Paid' : order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          {order.order_items?.slice(0, 2).map((item, index) => (
                            <div key={index} className="text-xs">
                              {item.product_title} 
                              {item.variant_title && item.variant_title !== 'Default Title' && (
                                <span className="text-gray-500"> - {item.variant_title}</span>
                              )}
                              <span className="text-gray-500"> (x{item.quantity})</span>
                            </div>
                          ))}
                          {order.order_items?.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{order.order_items.length - 2} more items
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${order.amount_total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(order.assigned_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={handleOrderUpdate}
          updating={updating === selectedOrder.order_id}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose, onUpdate, updating }) {
  const [status, setStatus] = useState(order.status);
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '');
  const [carrier, setCarrier] = useState(order.carrier || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const updateData = {};
    
    if (status !== order.status) {
      updateData.status = status;
    }
    if (trackingNumber !== (order.tracking_number || '')) {
      updateData.tracking_number = trackingNumber;
    }
    if (carrier !== (order.carrier || '')) {
      updateData.carrier = carrier;
    }

    if (Object.keys(updateData).length > 0) {
      onUpdate(order.order_id, updateData);
    }
  };

  const canTransition = (currentStatus, newStatus) => {
    const allowedTransitions = {
      'assigned': ['processing'],
      'processing': ['shipped']
    };
    return allowedTransitions[currentStatus]?.includes(newStatus);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Order {order.order_id}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>


          {/* Shipping Address */}
          {order.shipping_address && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Shipping Address</h3>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="text-sm text-gray-900">
                  <div>{order.shipping_address.firstName} {order.shipping_address.lastName}</div>
                  <div>{order.shipping_address.address1}</div>
                  {order.shipping_address.address2 && <div>{order.shipping_address.address2}</div>}
                  <div>{order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}</div>
                  <div>{order.shipping_address.country}</div>
                  {order.shipping_address.phone && <div>{order.shipping_address.phone}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Order Items</h3>
            <div className="space-y-3">
              {order.order_items?.map((item, index) => {
                const productImage = item.product_data?.images?.[0]?.src || item.product_data?.image_url;
                return (
                  <div key={index} className="flex items-center space-x-3 bg-gray-50 p-3 rounded-md">
                    {productImage && (
                      <img
                        src={productImage}
                        alt={item.product_title}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.product_title}</div>
                      {item.variant_title && item.variant_title !== 'Default Title' && (
                        <div className="text-xs text-gray-500">Variant: {item.variant_title}</div>
                      )}
                      <div className="text-xs text-gray-500">Quantity: {item.quantity} × ${item.price}</div>
                    </div>
                    <div className="text-sm font-medium">${(item.quantity * item.price).toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Update Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                disabled={updating}
              >
                <option value="assigned">Assigned</option>
                {canTransition('assigned', 'processing') && (
                  <option value="processing">Processing</option>
                )}
                {(order.status === 'processing' || status === 'processing') && (
                  <option value="shipped">Shipped</option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                You can only update: Assigned → Processing → Shipped
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Number {status === 'shipped' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  placeholder="Enter tracking number"
                  disabled={updating}
                  required={status === 'shipped'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carrier
                </label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                  placeholder="UPS, FedEx, USPS, etc."
                  disabled={updating}
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md disabled:opacity-50"
                disabled={updating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md disabled:opacity-50"
                disabled={updating}
              >
                {updating ? 'Updating...' : 'Update Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PartnerPage() {
  return (
    <PartnerProvider>
      <PartnerDashboard />
    </PartnerProvider>
  );
} 