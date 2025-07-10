'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useFarcaster } from '@/lib/useFarcaster';

export function OrderSuccessClient({ orderNumber }) {
  const { isInFarcaster } = useFarcaster();
  const [orderData, setOrderData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch order details on component mount
  useEffect(() => {
    fetchOrderDetails();
  }, [orderNumber]);

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
      
      const response = await fetch(`/api/orders?orderNumber=${encodeURIComponent(searchOrderNumber)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch order: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.order) {
        setOrderData(data.order);
        console.log('Order data loaded:', data.order);
      } else {
        // Try without # prefix
        const responseWithoutHash = await fetch(`/api/orders?orderNumber=${encodeURIComponent(orderNumber)}`);
        
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

  // Share order function
  const handleShareOrder = async () => {
    if (!isInFarcaster) {
      // Fallback for non-Farcaster environments
      if (navigator.share) {
        try {
          const mainProduct = orderData?.line_items?.[0]?.title || 'item';
          await navigator.share({
            title: `Order ${orderNumber} Confirmed - Minted Merch`,
            text: `🎉 Just bought ${mainProduct} with USDC! Order ${orderNumber} for $${orderData?.amount_total || '0.00'} confirmed ✅ Shop on /mintedmerch - pay on Base 🔵`,
            url: window.location.href,
          });
        } catch (err) {
          console.log('Error sharing:', err);
        }
      } else {
        // Copy link to clipboard
        try {
          await navigator.clipboard.writeText(window.location.href);
          alert('Order link copied to clipboard!');
        } catch (err) {
          console.log('Error copying to clipboard:', err);
        }
      }
      return;
    }

    // Farcaster sharing using SDK composeCast action
    try {
      const mainProduct = orderData?.line_items?.[0]?.title || 'item';
      const shareText = `🎉 Just bought ${mainProduct} with USDC!\n\nOrder ${orderNumber} for $${orderData?.amount_total || '0.00'} confirmed ✅\n\nShop on /mintedmerch - pay on Base 🔵`;
      
      // Use this order page URL for sharing (which has dynamic OG images)
      const orderUrl = window.location.href;
      
      // Use the Farcaster SDK composeCast action
      const { sdk } = await import('../../../lib/frame');
      const result = await sdk.actions.composeCast({
        text: shareText,
        embeds: [orderUrl],
      });
      
      console.log('Order cast composed:', result);
    } catch (error) {
      console.error('Error sharing order:', error);
      // Fallback to copying link
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Order link copied to clipboard!');
      } catch (err) {
        console.log('Error copying to clipboard:', err);
      }
    }
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
            className="flex items-center justify-center w-10 h-10 bg-[#8A63D2] hover:bg-[#7C5BC7] text-white rounded-lg transition-colors"
            title="Share on Farcaster"
          >
            {/* Official Farcaster Logo */}
            <svg className="w-5 h-5" viewBox="0 0 1000 1000" fill="currentColor">
              <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
              <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
              <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
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
                     <a
                       href={getTransactionLink(orderData.transaction_hash || orderData.payment_intent_id)}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="font-mono text-blue-600 hover:text-blue-800 underline text-sm"
                     >
                       {formatTransactionHash(orderData.transaction_hash || orderData.payment_intent_id)}
                     </a>
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
            className="w-full bg-[#8A63D2] hover:bg-[#7C5BC7] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {/* Official Farcaster Logo */}
            <svg className="w-5 h-5" viewBox="0 0 1000 1000" fill="currentColor">
              <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
              <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
              <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
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