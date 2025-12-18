'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PartnerProvider, usePartner } from '@/lib/PartnerContext';
import { ProfileModal } from '@/components/ProfileModal';
import { useFarcaster } from '@/lib/useFarcaster';
import { triggerHaptic } from '@/lib/haptics';

function PartnerDashboard() {
  const [orders, setOrders] = useState([]);
  const [partnerType, setPartnerType] = useState('fulfillment'); // 'fulfillment' or 'collab'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { partner, isAuthenticated, loading: authLoading, logout } = usePartner();
  const { user, getPfpUrl, getDisplayName, getUsername, isInFarcaster } = useFarcaster();
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
        setPartnerType(result.partnerType || 'fulfillment');
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
        await loadOrders();
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
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'payment_processing': return 'bg-yellow-100 text-yellow-800';
      case 'vendor_paid': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusLabel = (status) => {
    switch (status) {
      case 'assigned': return 'Assigned';
      case 'shipped': return 'Shipped';
      case 'payment_processing': return 'Payment Processing';
      case 'vendor_paid': return 'Paid';
      default: return status;
    }
  };

  // Get profile picture - prefer partner data, fall back to Farcaster user data
  const profilePicUrl = partner?.pfp_url || getPfpUrl();
  const displayName = partner?.display_name || partner?.name || getDisplayName() || getUsername();

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
          <div className="py-4 flex items-center justify-between">
            {/* Logo - links back to shop */}
            <button
              onClick={() => {
                triggerHaptic('light', isInFarcaster);
                window.location.href = '/';
              }}
              className="cursor-pointer"
            >
              <img 
                src="/MintedMerchPartnerLogo.png" 
                alt="Minted Merch Partner"
                className="h-10 sm:h-12 object-contain"
              />
            </button>
            
            {/* Profile Button with username display - same pattern as /missions */}
            <button
              onClick={() => {
                triggerHaptic('light', isInFarcaster);
                setShowProfileModal(true);
              }}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1 transition-colors"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {profilePicUrl ? (
                  <img 
                    src={profilePicUrl} 
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-500 text-sm">👤</span>
                )}
              </div>
              <span className="text-gray-700 text-sm">
                @{partner?.username || getUsername() || partner?.name}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Payout Stats Summary */}
        {orders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {/* Completed Payouts */}
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
              <div className="text-xs text-teal-600 font-medium uppercase tracking-wide">Completed Payouts</div>
              <div className={`text-2xl font-bold mt-1 ${
                orders.filter(o => o.status === 'vendor_paid').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_amount) || 0), 0) < 0 
                  ? 'text-red-600' 
                  : 'text-teal-700'
              }`}>
                ${orders.filter(o => o.status === 'vendor_paid').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_amount) || 0), 0).toFixed(2)}
              </div>
              <div className="text-xs text-teal-500 mt-1">
                {orders.filter(o => o.status === 'vendor_paid').length} order{orders.filter(o => o.status === 'vendor_paid').length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Estimated Payouts */}
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="text-xs text-yellow-600 font-medium uppercase tracking-wide">Est. Processing</div>
              <div className={`text-2xl font-bold mt-1 ${
                orders.filter(o => o.status === 'payment_processing').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_estimated) || 0), 0) < 0 
                  ? 'text-red-600' 
                  : 'text-yellow-700'
              }`}>
                ~${orders.filter(o => o.status === 'payment_processing').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_estimated) || 0), 0).toFixed(2)}
              </div>
              <div className="text-xs text-yellow-500 mt-1">
                {orders.filter(o => o.status === 'payment_processing').length} order{orders.filter(o => o.status === 'payment_processing').length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Pending Orders */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Pending</div>
              <div className="text-2xl font-bold mt-1 text-blue-700">
                {orders.filter(o => o.status === 'assigned' || o.status === 'shipped').length}
              </div>
              <div className="text-xs text-blue-500 mt-1">
                {orders.filter(o => o.status === 'assigned').length} assigned, {orders.filter(o => o.status === 'shipped').length} shipped
              </div>
            </div>
            
            {/* Combined Total */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Total Earnings</div>
              <div className={`text-2xl font-bold mt-1 ${
                (orders.filter(o => o.status === 'vendor_paid').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_amount) || 0), 0) +
                 orders.filter(o => o.status === 'payment_processing').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_estimated) || 0), 0)) < 0
                  ? 'text-red-600'
                  : 'text-gray-900'
              }`}>
                ${(orders.filter(o => o.status === 'vendor_paid').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_amount) || 0), 0) +
                   orders.filter(o => o.status === 'payment_processing').reduce((sum, o) => sum + (parseFloat(o.vendor_payout_estimated) || 0), 0)).toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Paid + Est. Processing
              </div>
            </div>
          </div>
        )}

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
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden divide-y divide-gray-200">
                {orders.map((order) => (
                  <div key={order.order_id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900">{order.order_id}</div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">${order.amount_total}</div>
                        {/* Show estimated payout during payment processing */}
                        {order.status === 'payment_processing' && order.vendor_payout_estimated && (
                          <div className={`text-sm ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                            ~${parseFloat(order.vendor_payout_estimated).toFixed(2)} est.
                          </div>
                        )}
                        {/* Show final payout when paid */}
                        {order.status === 'vendor_paid' && order.vendor_payout_amount && (
                          <div className={`text-sm ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                            ${parseFloat(order.vendor_payout_amount).toFixed(2)} payout
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {partnerType === 'fulfillment' && order.shipping_address && order.status === 'assigned' && (
                      <div className="text-sm text-gray-600">
                        <div className="font-medium text-gray-900">
                          {order.customer_name || `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`}
                        </div>
                        <div>{order.shipping_address.address1}</div>
                        <div>{order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}</div>
                      </div>
                    )}
                    
                    {/* Show tracking info instead of address for shipped/processing/paid orders */}
                    {partnerType === 'fulfillment' && (order.status === 'shipped' || order.status === 'payment_processing' || order.status === 'vendor_paid') && order.tracking_number && (
                      <div className="text-sm text-gray-600">
                        <div className="font-medium text-green-700">✅ Shipped</div>
                        <div className="text-xs">Tracking: {order.tracking_number}</div>
                      </div>
                    )}
                    
                    {partnerType === 'collab' && order.profiles && (
                      <div className="flex items-center space-x-2">
                        {order.profiles.pfp_url && (
                          <img src={order.profiles.pfp_url} alt={order.profiles.username} className="w-8 h-8 rounded-full" />
                        )}
                        <div>
                          <div className="font-medium">@{order.profiles.username}</div>
                          <div className="text-xs text-gray-500">FID: {order.fid}</div>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500">
                      {order.order_items?.length || 0} item(s) • Assigned {formatDate(order.assigned_at)}
                    </div>
                    
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="w-full bg-[#3eb489] hover:bg-[#359970] text-white px-4 py-2 rounded-md text-sm"
                    >
                      {partnerType === 'fulfillment' ? 'View Details' : 'View Order'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {partnerType === 'fulfillment' ? 'Shipping Address' : 'Customer'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Discount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payout
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
                        {partnerType === 'fulfillment' ? (
                          // Hide shipping address once shipped/processing/paid - show tracking instead
                          order.status === 'shipped' || order.status === 'payment_processing' || order.status === 'vendor_paid' ? (
                            order.tracking_number ? (
                              <div>
                                <div className="font-medium text-green-700">✅ Shipped</div>
                                <div className="text-xs text-gray-500">Tracking: {order.tracking_number}</div>
                                {order.carrier && <div className="text-xs text-gray-400">{order.carrier}</div>}
                              </div>
                            ) : (
                              <div className="font-medium text-green-700">✅ Shipped</div>
                            )
                          ) : order.shipping_address ? (
                            <div>
                              <div className="font-medium">
                                {order.customer_name || `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`}
                              </div>
                              <div className="text-xs text-gray-500">{order.shipping_address.address1}</div>
                              {order.shipping_address.address2 && (
                                <div className="text-xs text-gray-500">{order.shipping_address.address2}</div>
                              )}
                              <div className="text-xs text-gray-500">
                                {order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}
                              </div>
                              <div className="text-xs text-gray-500">{order.shipping_address.country}</div>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-xs">No address</div>
                          )
                        ) : (
                          order.profiles ? (
                            <div className="flex items-center space-x-2">
                              {order.profiles.pfp_url && (
                                <img
                                  src={order.profiles.pfp_url}
                                  alt={order.profiles.username}
                                  className="w-8 h-8 rounded-full"
                                />
                              )}
                              <div>
                                <div className="font-medium">@{order.profiles.username}</div>
                                {order.profiles.display_name && (
                                  <div className="text-xs text-gray-500">{order.profiles.display_name}</div>
                                )}
                                <div className="text-xs text-gray-500">FID: {order.fid}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500 text-xs">FID: {order.fid}</div>
                          )
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.discount_code ? (
                          <div>
                            <div className="font-medium text-gray-900">{order.discount_code}</div>
                            <div className="text-xs text-green-600">${parseFloat(order.discount_amount || 0).toFixed(2)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${order.amount_total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {/* Show final payout when vendor_paid */}
                        {order.status === 'vendor_paid' && order.vendor_payout_amount ? (
                          <div>
                            <div className={`font-medium ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                              ${parseFloat(order.vendor_payout_amount).toFixed(2)}
                            </div>
                            {order.vendor_paid_at && (
                              <div className="text-xs text-gray-500">{formatDate(order.vendor_paid_at)}</div>
                            )}
                          </div>
                        ) : order.status === 'vendor_paid' ? (
                          <span className="text-teal-600 text-xs">Paid</span>
                        ) : order.status === 'payment_processing' && order.vendor_payout_estimated ? (
                          <div>
                            <div className={`font-medium ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                              ~${parseFloat(order.vendor_payout_estimated).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">Est.</div>
                          </div>
                        ) : order.status === 'payment_processing' ? (
                          <span className="text-yellow-600 text-xs">Processing</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(order.assigned_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {partnerType === 'fulfillment' ? 'View Details' : 'View Order'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          partnerType={partnerType}
          onClose={() => setSelectedOrder(null)}
          onUpdate={handleOrderUpdate}
          updating={updating === selectedOrder.order_id}
        />
      )}

      {/* Profile Modal - Use the standard ProfileModal component */}
      <ProfileModal 
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onSignOut={logout}
      />
    </div>
  );
}

function OrderDetailModal({ order, partnerType, onClose, onUpdate, updating }) {
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '');
  const [carrier, setCarrier] = useState(order.carrier || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!trackingNumber.trim()) {
      alert('Please enter a tracking number');
      return;
    }

    onUpdate(order.order_id, {
      tracking_number: trackingNumber,
      carrier: carrier
    });
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

          {/* Conditional Display: Shipping Address OR Farcaster Info */}
          {/* For fulfillment partners: hide shipping address once shipped/processing/paid */}
          {partnerType === 'fulfillment' ? (
            order.status === 'shipped' || order.status === 'payment_processing' || order.status === 'vendor_paid' ? (
              // Order already shipped - don't show shipping address
              null
            ) : order.shipping_address ? (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Shipping Address</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="text-sm text-gray-900">
                    <div className="font-medium">
                      {order.customer_name || `${order.shipping_address.firstName || ''} ${order.shipping_address.lastName || ''}`}
                    </div>
                    <div>{order.shipping_address.address1}</div>
                    {order.shipping_address.address2 && <div>{order.shipping_address.address2}</div>}
                    <div>{order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}</div>
                    <div>{order.shipping_address.country}</div>
                  </div>
                </div>
              </div>
            ) : null
          ) : (
            order.profiles && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Customer</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="flex items-center space-x-3">
                    {order.profiles.pfp_url && (
                      <img
                        src={order.profiles.pfp_url}
                        alt={order.profiles.username}
                        className="w-16 h-16 rounded-full"
                      />
                    )}
                    <div className="text-sm text-gray-900">
                      <div className="font-medium text-lg">@{order.profiles.username}</div>
                      {order.profiles.display_name && (
                        <div className="text-gray-600">{order.profiles.display_name}</div>
                      )}
                      <div className="text-gray-500 text-xs mt-1">Farcaster ID: {order.fid}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
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
            
            {order.discount_code && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Discount Applied</div>
                    <div className="text-xs text-gray-600">Code: {order.discount_code}</div>
                  </div>
                  <div className="text-sm font-semibold text-green-600">
                    -${parseFloat(order.discount_amount || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-lg font-semibold text-gray-900">Order Total</div>
                <div className="text-lg font-bold text-gray-900">${parseFloat(order.amount_total).toFixed(2)}</div>
              </div>
            </div>

            {/* Estimated Payout - during payment processing */}
            {order.status === 'payment_processing' && order.vendor_payout_estimated && (
              <div className={`mt-4 ${parseFloat(order.vendor_payout_estimated) < 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border rounded-md p-4`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-sm font-medium ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-800' : 'text-yellow-800'}`}>
                      ⏳ Estimated Payout
                    </div>
                    {order.payment_processing_at && (
                      <div className={`text-xs ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-600' : 'text-yellow-600'} mt-1`}>
                        Processing since {new Date(order.payment_processing_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                  <div className={`text-xl font-bold ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                    ${parseFloat(order.vendor_payout_estimated).toFixed(2)}
                  </div>
                </div>
                {order.vendor_payout_partner_notes && (
                  <div className={`text-xs ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-700' : 'text-yellow-700'} mt-2 pt-2 border-t ${parseFloat(order.vendor_payout_estimated) < 0 ? 'border-red-200' : 'border-yellow-200'}`}>
                    {order.vendor_payout_partner_notes}
                  </div>
                )}
              </div>
            )}

            {/* Final Payout - when vendor_paid */}
            {order.vendor_payout_amount && (
              <div className={`mt-4 ${parseFloat(order.vendor_payout_amount) < 0 ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'} border rounded-md p-4`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-sm font-medium ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-800' : 'text-teal-800'}`}>
                      💰 Your Payout
                    </div>
                    {order.vendor_paid_at && (
                      <div className={`text-xs ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-600' : 'text-teal-600'} mt-1`}>
                        Paid on {new Date(order.vendor_paid_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                  <div className={`text-xl font-bold ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-700' : 'text-teal-700'}`}>
                    ${parseFloat(order.vendor_payout_amount).toFixed(2)}
                  </div>
                </div>
                {order.vendor_payout_partner_notes && (
                  <div className={`text-xs ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-700' : 'text-teal-700'} mt-2 pt-2 border-t ${parseFloat(order.vendor_payout_amount) < 0 ? 'border-red-200' : 'border-teal-200'}`}>
                    {order.vendor_payout_partner_notes}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shipping Form - Only for Fulfillment Partners */}
          {partnerType === 'fulfillment' ? (
            order.status === 'shipped' || order.status === 'payment_processing' || order.status === 'vendor_paid' ? (
              <div className="space-y-4">
                {/* Shipped Status */}
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">📦</span>
                    <div>
                      <p className="text-sm font-medium text-green-800">Order Shipped</p>
                      {order.shipped_at && (
                        <p className="text-xs text-green-600">
                          {new Date(order.shipped_at).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Processing Status */}
                {(order.status === 'payment_processing' || order.status === 'vendor_paid') && order.payment_processing_at && (
                  <div className={`${order.vendor_payout_estimated && parseFloat(order.vendor_payout_estimated) < 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border rounded-md p-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`${order.vendor_payout_estimated && parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-600' : 'text-yellow-600'} mr-2`}>⏳</span>
                        <div>
                          <p className={`text-sm font-medium ${order.vendor_payout_estimated && parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-800' : 'text-yellow-800'}`}>
                            {order.status === 'payment_processing' ? 'Vendor Payment Processing' : 'Payment Was Processing'}
                          </p>
                          <p className={`text-xs ${order.vendor_payout_estimated && parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                            {new Date(order.payment_processing_at).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      {order.vendor_payout_estimated && (
                        <span className={`text-lg font-bold ${parseFloat(order.vendor_payout_estimated) < 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                          ~${parseFloat(order.vendor_payout_estimated).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Payout Status */}
                {order.status === 'vendor_paid' && (
                  <div className={`${order.vendor_payout_amount && parseFloat(order.vendor_payout_amount) < 0 ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'} border rounded-md p-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`${order.vendor_payout_amount && parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-600' : 'text-teal-600'} mr-2`}>💰</span>
                        <div>
                          <p className={`text-sm font-medium ${order.vendor_payout_amount && parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-800' : 'text-teal-800'}`}>Payout Processed</p>
                          {order.vendor_paid_at && (
                            <p className={`text-xs ${order.vendor_payout_amount && parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                              {new Date(order.vendor_paid_at).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      {order.vendor_payout_amount && (
                        <span className={`text-lg font-bold ${parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-700' : 'text-teal-700'}`}>
                          ${parseFloat(order.vendor_payout_amount).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {order.vendor_payout_partner_notes && (
                      <p className={`text-xs ${order.vendor_payout_amount && parseFloat(order.vendor_payout_amount) < 0 ? 'text-red-700' : 'text-teal-700'} mt-2 pt-2 border-t ${order.vendor_payout_amount && parseFloat(order.vendor_payout_amount) < 0 ? 'border-red-200' : 'border-teal-200'}`}>
                        {order.vendor_payout_partner_notes}
                      </p>
                    )}
                  </div>
                )}
                
                {order.tracking_number && (
                  <div className="bg-gray-50 rounded-md p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Tracking Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Tracking Number:</span>
                        <div className="font-medium">{order.tracking_number}</div>
                      </div>
                      {order.carrier && (
                        <div>
                          <span className="text-gray-500">Carrier:</span>
                          <div className="font-medium">{order.carrier}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-md"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    📦 <strong>Enter tracking info to mark as shipped.</strong> Order will automatically be marked as shipped and customer will be notified.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tracking Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
                      placeholder="Enter tracking number"
                      disabled={updating}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Carrier <span className="text-gray-400">(Optional)</span>
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
                    {updating ? 'Shipping...' : 'Mark as Shipped'}
                  </button>
                </div>
              </form>
            )
          ) : (
            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-md"
              >
                Close
              </button>
            </div>
          )}
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
