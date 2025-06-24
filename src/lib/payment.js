import { sdk } from './frame';

const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_HEX = '0x2105';

export async function checkFrameContext() {
  const context = await sdk.context;
  if (!context) {
    throw new Error('Please open this app in Farcaster');
  }
  return context;
}

export async function switchToBase() {
  const chainId = await sdk.wallet.ethProvider.request({
    method: 'eth_chainId'
  });
  
  const chainIdDecimal = typeof chainId === 'number' ? chainId : parseInt(chainId, 16);
  
  if (chainIdDecimal !== BASE_CHAIN_ID) {
    await sdk.wallet.ethProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_HEX }]
    });
  }
}

export async function getWalletAddress() {
  const accounts = await sdk.wallet.ethProvider.request({
    method: 'eth_requestAccounts'
  });
  
  if (!accounts || !accounts[0]) {
    throw new Error('No wallet connected');
  }
  
  return accounts[0];
}

export async function sendUSDCPayment(amount, recipient) {
  // Convert amount to USDC decimals (6 decimals)
  const amountInDecimals = Math.floor(parseFloat(amount) * 1e6);
  const amountHex = '0x' + amountInDecimals.toString(16);
  
  // Prepare transfer data
  const transferFunctionSignature = '0xa9059cbb'; // transfer(address,uint256)
  const recipientPadded = recipient.slice(2).padStart(64, '0');
  const amountPadded = amountHex.slice(2).padStart(64, '0');
  
  const data = `${transferFunctionSignature}${recipientPadded}${amountPadded}`;
  
  const walletAddress = await getWalletAddress();
  
  // Send transaction
  const txHash = await sdk.wallet.ethProvider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: walletAddress,
      to: USDC_CONTRACT_ADDRESS,
      data: data,
      value: '0x0'
    }]
  });
  
  return txHash;
}

export function extractUserInfo(context) {
  if (!context.user) return { firstName: '', lastName: '' };
  
  const displayName = context.user.displayName || context.user.username || '';
  const nameParts = displayName.split(' ');
  
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    fid: context.user.fid
  };
}