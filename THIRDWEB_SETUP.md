# 🚀 Thirdweb API Setup for Ambassador Claims

## ✅ Changes Made

We've switched from client-side signature verification to **backend-executed airdrops** using Thirdweb's API. This is:
- ✅ **More reliable** - No EIP-712 signature format issues
- ✅ **Gasless for ambassadors** - Backend pays gas fees
- ✅ **Simpler** - One-click instant claims
- ✅ **Better UX** - No wallet approval needed

## 🔐 Required Environment Variables

Add these to your **Vercel** environment variables:

### 1. Get Your Thirdweb Secret Key

1. Go to: https://thirdweb.com/dashboard
2. Navigate to **Settings** → **API Keys**
3. Click **"Create New API Key"**
4. Copy your **Secret Key**

### 2. Add to Vercel

Go to your Vercel project settings and add:

```bash
# Thirdweb API Key
THIRDWEB_SECRET_KEY=your_secret_key_here

# Admin Wallet (must own the airdrop contract)
ADMIN_WALLET_ADDRESS=0xYourAdminWalletAddress

# Contract Addresses (already set, verify they're correct)
AIRDROP_CONTRACT_ADDRESS=0x8569755C6fa4127b3601846077FFB5D083586500
MINTEDMERCH_TOKEN_ADDRESS=0x774EAeFE73Df7959496Ac92a77279A8D7d690b07
```

### 3. Deploy

After adding the environment variables:
1. Redeploy your Vercel app (or it will auto-deploy)
2. Test the claim flow!

## 📝 How It Works

### Before (Client-Side with Signatures):
1. Ambassador clicks "Claim"
2. Frontend fetches signature from backend
3. Frontend calls contract with Wagmi
4. **User approves transaction in wallet** ⚠️
5. **User pays gas fees** ⚠️
6. Contract verifies signature
7. Tokens transferred

### After (Backend-Executed via Thirdweb API):
1. Ambassador clicks "Claim Tokens"
2. Frontend calls `/api/ambassador/payouts/[id]/claim`
3. **Backend calls Thirdweb API to execute airdrop**
4. **Backend pays gas fees (via Thirdweb)**
5. Tokens transferred instantly ✅
6. Frontend shows success message

## 🧪 Testing

1. Approve a bounty submission (creates claimable payout)
2. Go to Ambassador Dashboard → Payouts tab
3. Click "Claim Tokens" on a claimable payout
4. Should see success message with Basescan link
5. Check the ambassador's wallet - tokens should appear!

## 🔍 Debug Endpoints

If you need to troubleshoot:

- **Check Config**: `https://app.mintedmerch.shop/api/debug/claim-config`
  - Shows if THIRDWEB_SECRET_KEY is set
  - Shows admin wallet address
  - Shows contract addresses

- **Check Contract**: `https://app.mintedmerch.shop/api/debug/contract-info`
  - Verifies contract exists on Base
  - Shows contract owner/admin

(Both endpoints require admin authentication)

## ⚠️ Important Notes

- **THIRDWEB_SECRET_KEY** must be kept secret (server-side only)
- Your **ADMIN_WALLET_ADDRESS** must be the owner of the airdrop contract
- The contract must have enough token allowance to send airdrops
- Thirdweb bills you for gas fees (check their pricing)

## 💰 Cost Considerations

With Thirdweb API:
- You pay for gas fees (absorbed as cost of doing business)
- Ambassadors get instant, gasless claims
- Much better user experience
- Worth the gas cost for simplicity and reliability

## ✅ Success Indicators

When working correctly:
- ✅ Button shows "No gas fees" text
- ✅ Clicking "Claim Tokens" shows "Claiming..." spinner
- ✅ Success alert with Basescan transaction link
- ✅ Payout status changes to "completed"
- ✅ Tokens appear in ambassador's wallet
- ✅ Transaction visible on Basescan

## 🐛 Troubleshooting

### "Service configuration error"
- Missing `THIRDWEB_SECRET_KEY` in Vercel
- Add the key and redeploy

### "Failed to execute airdrop"
- Check Vercel logs for Thirdweb API error
- Verify admin wallet owns the contract
- Ensure contract has token allowance
- Check Thirdweb dashboard for API key status

### Tokens not appearing
- Check transaction on Basescan
- Verify wallet address in payout record is correct
- Ensure contract has enough tokens approved

---

**Questions?** Check the Thirdweb documentation: https://portal.thirdweb.com/contracts/write

