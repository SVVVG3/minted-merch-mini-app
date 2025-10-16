# WalletConnect App SDK Integration Setup

This document explains how to set up WalletConnect App SDK integration for desktop and mobile web users.

## Overview

WalletConnect App SDK integration allows users visiting the site on desktop or mobile web (not in mini app environments like Farcaster or dGEN1) to connect their wallets and make payments or use the daily check-in wheel using the Universal Connector.

## Setup Steps

### 1. Get WalletConnect Project ID

1. Go to [WalletConnect Dashboard](https://dashboard.reown.com)
2. Create a new project
3. Copy your Project ID

### 2. Install App SDK Packages

The following packages are installed:

```bash
npm install @reown/appkit @reown/appkit-universal-connector @reown/appkit-common ethers
```

### 3. Add Environment Variable

Add the following environment variable to your `.env.local` file:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### 4. Deploy

The WalletConnect App SDK integration is already implemented and will automatically activate when the environment variable is set.

## How It Works

### Environment Detection

The system automatically detects the user's environment and chooses the appropriate wallet connection method:

1. **Farcaster Mini App**: Uses Farcaster SDK (existing functionality)
2. **dGEN1/Base App**: Uses Base Account SDK (existing functionality)  
3. **Desktop/Mobile Web**: Uses WalletConnect (new functionality)
4. **Browser with Wallet Extension**: Uses existing wallet connection

### Connection Priority

1. **Farcaster Mini App** (highest priority)
2. **Existing wallet connection** (window.ethereum)
3. **WalletConnect** (fallback for web users)
4. **No connection available**

### Features

- **Universal Connector for multi-chain support**
- **Automatic environment detection**
- **Seamless integration with existing functionality**
- **Support for Base network transactions**
- **Daily check-in wheel access**
- **Checkout flow integration**
- **Provider access for transactions**
- **No breaking changes to existing functionality**

## Usage

### For Users

Users visiting the site on desktop or mobile web will see a "Connect Wallet" button that opens WalletConnect. They can then:

1. Scan QR code with their mobile wallet
2. Connect via desktop wallet
3. Make payments and use all features

### For Developers

The integration provides several components and hooks:

```jsx
import { WalletConnectProvider, WalletConnectButton } from '@/components/WalletConnectProvider';

// Use the provider in your app
<WalletConnectProvider>
  <WalletConnectButton />
</WalletConnectProvider>
```

## Components

### WalletConnectProvider

Main provider component that manages wallet connection state and provides context to child components.

### WalletConnectButton

Button component that shows the appropriate connection method based on environment and connection state.

### useWalletConnectContext

Hook to access wallet connection state and methods:

```jsx
const {
  isConnected,
  userAddress,
  connectionMethod,
  connectWallet,
  disconnectWallet,
  getWalletProvider
} = useWalletConnectContext();
```

## Security

- All transactions are handled through the same secure backend
- WalletConnect sessions are properly managed and cleaned up
- No sensitive data is stored in the frontend
- Same security measures apply as existing wallet connections

## Troubleshooting

### WalletConnect Not Available

- Check that `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- Verify the project ID is correct in WalletConnect Dashboard
- Check browser console for initialization errors

### Connection Issues

- Ensure user has a compatible wallet installed
- Check that the wallet supports Base network
- Verify network connectivity

### Environment Detection Issues

- Check browser user agent strings
- Verify the environment detection logic in `shouldUseWalletConnect()`

## Testing

To test the WalletConnect integration:

1. Visit the site on desktop/mobile web (not in Farcaster)
2. Look for the "Connect Wallet" button
3. Click to open WalletConnect
4. Connect with a compatible wallet
5. Test payment flow and daily wheel

## Future Enhancements

- Support for additional networks
- Enhanced transaction handling
- Better error handling and user feedback
- Mobile app deep linking
