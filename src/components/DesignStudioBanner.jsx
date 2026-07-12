'use client';

import Link from 'next/link';
import { sdk } from '@farcaster/miniapp-sdk';

export function DesignStudioBanner({ compact = false, className = '', fullWidth = false }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Link
        href="/create"
        onClick={() => {
          try { sdk.haptics.impactOccurred('medium'); } catch {}
        }}
        className={`${fullWidth ? 'w-full' : 'w-full max-w-xs'} block rounded-xl overflow-hidden shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-r from-purple-700 to-[#3eb489] p-[2px]`}
      >
        <div className={`bg-gray-900 rounded-xl px-4 flex items-center justify-center ${compact ? 'py-2' : 'py-3'}`}>
          <img
            src="/EnterTheMintedMerchDesignStudio.png"
            alt="Enter the Minted Merch Design Studio"
            className={`w-full h-auto object-contain ${compact ? 'max-h-7' : 'max-h-9'}`}
          />
        </div>
      </Link>
    </div>
  );
}
