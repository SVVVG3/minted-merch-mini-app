import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export function TransactionViewer({ transactionHash, onBack }) {
  useEffect(() => {
    // Enable back navigation when component mounts
    const enableBackNavigation = async () => {
      try {
        const capabilities = await sdk.getCapabilities();
        if (capabilities.includes('back')) {
          // Set up back handler
          sdk.back.onback = () => {
            if (onBack) {
              onBack();
            }
          };
          await sdk.back.show();
        }
      } catch (error) {
        console.log('Back navigation not available:', error);
      }
    };

    enableBackNavigation();

    // Cleanup when component unmounts
    return () => {
      try {
        sdk.back.hide();
        sdk.back.onback = null;
      } catch (error) {
        // Ignore errors during cleanup
      }
    };
  }, [onBack]);

  const baseScanUrl = `https://basescan.org/tx/${transactionHash}`;

  const handleOpenTransaction = async () => {
    try {
      await sdk.actions.openUrl(baseScanUrl);
    } catch (error) {
      console.error('Failed to open URL with SDK:', error);
      // Fallback to traditional methods if SDK fails
      try {
        if (window.top && window.top !== window) {
          window.top.location.href = baseScanUrl;
        } else {
          window.location.href = baseScanUrl;
        }
      } catch (e) {
        window.open(baseScanUrl, '_blank');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header with manual back button as fallback */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        <h1 className="text-lg font-semibold">Transaction Details</h1>
        <div className="w-16"> {/* Spacer for center alignment */}</div>
      </div>

      {/* Transaction info */}
      <div className="p-4 bg-blue-50 border-b">
        <div className="text-sm text-gray-600 mb-1">Transaction Hash</div>
        <div className="text-xs font-mono break-all text-blue-600">{transactionHash}</div>
        <div className="text-xs text-gray-500 mt-2">
          View on BaseScan for full transaction details including gas fees, block confirmation, and more.
        </div>
      </div>

      {/* External link using proper SDK method */}
      <div className="flex-1 p-4">
        <div className="bg-white rounded-lg border shadow-sm p-6 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">View on BaseScan</h3>
          <p className="text-gray-600 text-sm mb-6">
            Click below to open this transaction on BaseScan in your device's browser for full details.
          </p>
          
          <button
            onClick={handleOpenTransaction}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Open BaseScan
          </button>
          
          <div className="mt-4 text-xs text-gray-500">
            This will open in your device's web browser
          </div>
        </div>
      </div>
    </div>
  );
} 