'use client';

import { useState } from 'react';
import { MiniAppNotificationPrompt } from './MiniAppNotificationPrompt';

export function OrderSuccess({ orderDetails }) {
  const [showMiniAppPrompt, setShowMiniAppPrompt] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-center">
          <h1 className="text-lg font-semibold text-gray-900">Order Complete!</h1>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center">
          <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank you for your order!</h2>
          <p className="text-gray-600 mb-4">Your order has been successfully placed.</p>
          <div className="bg-white p-4 rounded border border-green-200">
            <p className="text-sm text-gray-600">Order Number</p>
            <p className="text-lg font-mono font-medium text-gray-900">{orderDetails.name}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="font-medium text-gray-900 mb-2">Order Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium text-green-600">{orderDetails.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total:</span>
              <span className="font-medium">${orderDetails.total.amount} {orderDetails.total.currencyCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{orderDetails.customer.email}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.location.href = '/'}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Continue Shopping
        </button>
      </main>

      {/* Mini App Notification Prompt */}
      {showMiniAppPrompt && (
        <MiniAppNotificationPrompt
          orderNumber={orderDetails.name}
          onClose={() => setShowMiniAppPrompt(false)}
        />
      )}
    </div>
  );
}