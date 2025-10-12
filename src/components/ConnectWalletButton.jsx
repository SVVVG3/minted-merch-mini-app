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
    <div className="flex items-center">
      <w3m-button balance="hide" size="sm" />
    </div>
  );
}

