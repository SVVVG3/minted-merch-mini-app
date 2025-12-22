'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useFarcaster } from '@/lib/useFarcaster';
import { sdk } from '@farcaster/miniapp-sdk';

export function OrderSuccessClient({ orderNumber }) {
  const { isInFarcaster, getSessionToken, isReady } = useFarcaster();
  const [orderData, setOrderData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch order details on component mount - wait for Farcaster SDK to be ready
  useEffect(() => {
    // Wait for Farcaster context to be ready before fetching
    if (isReady) {
      fetchOrderDetails();
    }
  }, [orderNumber, isReady]);

  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Try different order number formats
      let searchOrderNumber = orderNumber;
      
      // First try with # prefix if not present
      if (!orderNumber.startsWith('#')) {
        searchOrderNumber = `#${orderNumber}`;
      }
      
      console.log('Fetching order details for:', searchOrderNumber);
      
      // 🔒 SECURITY: Include JWT token for authentication
      const sessionToken = getSessionToken();
      console.log('Session token available:', !!sessionToken);
      
      if (!sessionToken) {
        console.warn('⚠️ No session token available - order lookup will fail');
        setError('Authentication required. Please refresh the page and try again.');
        setIsLoading(false);
        return;
      }
      
      const headers = { 'Authorization': `Bearer ${sessionToken}` };
      
      const response = await fetch(`/api/orders?orderNumber=${encodeURIComponent(searchOrderNumber)}`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch order: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.order) {
        setOrderData(data.order);
        console.log('Order data loaded:', data.order);
      } else {
        // Try without # prefix (token already validated above)
        const responseWithoutHash = await fetch(`/api/orders?orderNumber=${encodeURIComponent(orderNumber)}`, { headers });
        
        if (responseWithoutHash.ok) {
          const dataWithoutHash = await responseWithoutHash.json();
          if (dataWithoutHash.success && dataWithoutHash.order) {
            setOrderData(dataWithoutHash.order);
            console.log('Order data loaded (without #):', dataWithoutHash.order);
          } else {
            throw new Error('Order not found');
          }
        } else {
          throw new Error('Order not found');
        }
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Format the transaction hash for display and link
  const formatTransactionHash = (hash) => {
    if (!hash) return null;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const getTransactionLink = (hash) => {
    if (!hash) return null;
    return `https://basescan.org/tx/${hash}`;
  };

  // Helper function to handle transaction link opening (same as OrderHistory)
  const handleOpenTransaction = async (transactionHash) => {
    if (!transactionHash) return;
    
    try {
      const baseScanUrl = `https://basescan.org/tx/${transactionHash}`;
      console.log('🔗 Opening transaction:', baseScanUrl);
      
      // Use the proper Farcaster SDK method to open in external browser
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

  // Share order function - ensure SDK is ready before composing
  const handleShareOrder = async () => {
    const mainProduct = orderData?.line_items?.[0]?.title || 'item';
    const orderUrl = `${window.location.origin}/order/${orderNumber}?t=${Date.now()}`;
    const shareText = `Just ordered my new ${mainProduct}!\n\nYou get 15% off your first order when you add the $mintedmerch mini app! 👀\n\nShop on @mintedmerch - pay onchain using 1200+ coins across 20+ chains ✨`;
    
    // Ensure SDK is ready (re-initialize after navigation)
    await sdk.actions.ready();
    
    await sdk.actions.composeCast({
      text: shareText,
      embeds: [orderUrl],
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Back Button */}
          <Link href="/" className="flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          
          {/* Title */}
          <h1 className="text-lg font-semibold text-gray-900 flex-1">
            Order Confirmed!
          </h1>
          
          {/* Share Button */}
          <button
            onClick={handleShareOrder}
            className="flex items-center justify-center w-10 h-10 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white rounded-lg transition-colors"
            title="Share on Farcaster"
          >
            {/* Official Farcaster Logo (2024 rebrand) */}
            <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800 font-medium">Error loading order details</span>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Order Success Content */}
        {orderData && (
          <>
            {/* Success Message */}
            <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center">
              <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank you for your order!</h2>
              <p className="text-gray-600 mb-4">Your order has been successfully placed and payment confirmed.</p>
              <div className="bg-white p-4 rounded border border-green-200">
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="text-lg font-mono font-medium text-gray-900">{orderData.order_id}</p>
              </div>
            </div>

            {/* Order Products */}
            {orderData.line_items && orderData.line_items.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h3 className="font-medium text-gray-900 mb-3">Items Ordered</h3>
                <div className="space-y-3">
                  {orderData.line_items.map((item, index) => (
                    <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-200 rounded-md overflow-hidden flex-shrink-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                          {item.title}
                        </h4>
                        {item.variant_title && item.variant_title !== 'Default Title' && (
                          <p className="text-xs text-gray-500 mt-1">
                            {item.variant_title}
                          </p>
                        )}
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-600">
                            Qty: {item.quantity}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium">{orderData.line_items?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-medium">${parseFloat(orderData.amount_total || 0).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment:</span>
                  <span className="font-medium text-green-600">Confirmed on Base 🔵</span>
                </div>
                                 {(orderData.transaction_hash || orderData.payment_intent_id) && (
                   <div className="flex justify-between items-center">
                     <span className="text-gray-600">Transaction:</span>
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         handleOpenTransaction(orderData.transaction_hash || orderData.payment_intent_id);
                       }}
                       className="font-mono text-blue-600 hover:text-blue-800 underline text-sm"
                     >
                       {formatTransactionHash(orderData.transaction_hash || orderData.payment_intent_id)}
                     </button>
                   </div>
                 )}
                {orderData.discount_code && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-green-600">
                      {orderData.discount_code} (-${parseFloat(orderData.discount_amount || 0).toFixed(2)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleShareOrder}
            className="w-full bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {/* Official Farcaster Logo (2024 rebrand) */}
            <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
            </svg>
            <span>Share My Purchase</span>
          </button>
          
          <Link href="/" className="block">
            <button className="w-full bg-[#3eb489] hover:bg-[#359970] text-white font-medium py-3 px-4 rounded-lg transition-colors">
              Continue Shopping
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
} 