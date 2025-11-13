import { createThirdwebClient } from 'thirdweb';

// Initialize Thirdweb client for frontend use
export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

