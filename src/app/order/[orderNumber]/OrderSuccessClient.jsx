'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFarcaster } from '@/lib/useFarcaster';

export function OrderSuccessClient({ orderNumber, total, products }) {
  const { isInFarcaster } = useFarcaster();

  // Share order function
  const handleShareOrder = async () => {
    if (!isInFarcaster) {
      // Fallback for non-Farcaster environments
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Order ${orderNumber} Confirmed - Minted Merch`,
            text: `🎉 Just bought ${products || 'crypto merch'} with USDC! Order ${orderNumber}${total ? ` for $${total}` : ''} confirmed ✅ Shop on /mintedmerch - pay on Base 🔵`,
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
      const shareText = `🎉 Just bought ${products || 'crypto merch'} with USDC!\n\nOrder ${orderNumber}${total ? ` for $${total}` : ''} confirmed ✅\n\nShop on /mintedmerch - pay on Base 🔵`;
      
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
        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center">
          <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank you for your order!</h2>
          <p className="text-gray-600 mb-4">Your order has been successfully placed and payment confirmed.</p>
          <div className="bg-white p-4 rounded border border-green-200">
            <p className="text-sm text-gray-600">Order Number</p>
            <p className="text-lg font-mono font-medium text-gray-900">{orderNumber}</p>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="font-medium text-gray-900 mb-3">Order Details</h3>
          <div className="space-y-2 text-sm">
            {products && (
              <div className="flex justify-between">
                <span className="text-gray-600">Items:</span>
                <span className="font-medium">{products}</span>
              </div>
            )}
            {total && (
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">${total} USDC</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Payment:</span>
              <span className="font-medium text-green-600">Confirmed on Base 🔵</span>
            </div>
          </div>
        </div>

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