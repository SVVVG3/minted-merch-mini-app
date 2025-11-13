'use client';

import { ThirdwebProvider as TW_Provider } from 'thirdweb/react';
import { client } from '@/lib/thirdwebClient';

export function ThirdwebProvider({ children }) {
  return (
    <TW_Provider>
      {children}
    </TW_Provider>
  );
}

