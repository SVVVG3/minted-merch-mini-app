'use client';

import { useEffect, useState } from 'react';

/**
 * Connect Wallet button for header
 * Uses Web3Modal's built-in button component with custom styling
 * Shows for non-mini-app users who need to connect a wallet for checkout and check-ins
 */
export function ConnectWalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on server
  if (!mounted) {
    return null;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          w3m-button {
            width: 48px !important;
            max-width: 48px !important;
          }
        `
      }} />
      <div className="w-12 h-12 flex items-center justify-center overflow-hidden shrink-0">
        <w3m-button balance="hide" size="sm" />
      </div>
    </>
  );
}

