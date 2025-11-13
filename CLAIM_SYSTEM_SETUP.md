# 🚀 Self-Service Payout Claims System - Setup Guide

## 📋 Overview

This system allows ambassadors to claim their bounty rewards instantly via smart contract, eliminating manual admin payouts.

**Status:** ✅ Code Complete - Ready for Testing

---

## 🔐 Environment Variables

Add these to your `.env.local` file:

```bash
# Smart Contract Addresses
AIRDROP_CONTRACT_ADDRESS=0x8569755C6fa4127b3601846077FFB5D083586500
MINTEDMERCH_TOKEN_ADDRESS=0x774EAeFE73Df7959496Ac92a77279A8D7d690b07

# Admin Wallet (for signing claims)
ADMIN_WALLET_PRIVATE_KEY=your_private_key_here
ADMIN_WALLET_ADDRESS=your_admin_address_here
```

### ⚠️ Security Notes:
- ✅ `ADMIN_WALLET_PRIVATE_KEY` must NEVER be exposed to client
- ✅ Keep in `.env.local` only (git ignored)
- ✅ Add to Vercel via encrypted environment variables
- ✅ Use a dedicated admin wallet (not personal wallet)

---

## 📦 Database Migration Required

**You must run this SQL in Supabase Dashboard:**

Location: `/supabase/migrations/20251113_add_claim_system.sql`

### To Run Migration:

1. Go to: [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `vbccqrwuqaqdfgtadgkf`
3. Click: **SQL Editor**
4. Click: **New Query**
5. Copy and paste the entire migration file
6. Click: **Run**

### What the Migration Does:
- ✅ Adds claim fields to `ambassador_payouts` table
- ✅ Creates `payout_claim_events` tracking table
- ✅ Sets up RLS policies for security
- ✅ Creates indexes for performance

---

## 🏗️ Files Created/Modified

### New Files:
1. ✅ `/src/lib/claimSignatureService.js` - Signature generation
2. ✅ `/src/app/api/ambassador/payouts/[id]/claim-data/route.js` - Claim data API
3. ✅ `/supabase/migrations/20251113_add_claim_system.sql` - Database schema

### Modified Files:
1. ✅ `/src/app/api/admin/bounty-submissions/[id]/approve/route.js` - Auto-generates signatures
2. ✅ `/src/app/ambassador/page.js` - Added claim button and logic

---

## 🧪 Testing Plan

### Phase 1: Database & Backend (DO THIS FIRST)
```bash
# 1. Run database migration in Supabase
# 2. Add environment variables to .env.local
# 3. Restart dev server: npm run dev
# 4. Check logs for errors
```

### Phase 2: Test Signature Generation
```bash
# 1. Go to Admin Dashboard
# 2. Approve a bounty submission
# 3. Check Vercel/console logs for:
#    "✍️ Generated claim signature..."
#    "✍️ Claim signature generated - payout is now claimable!"
# 4. Check Supabase:
#    - ambassador_payouts table
#    - Find the payout
#    - Verify: status = 'claimable'
#    - Verify: claim_signature exists
#    - Verify: claim_deadline exists
```

### Phase 3: Test Claim Data API
```bash
# 1. Go to Ambassador Dashboard as the ambassador
# 2. Navigate to Payouts tab
# 3. Should see "CLAIMABLE" status badge (purple)
# 4. Should see "Claim Tokens" button
# 5. Open browser console (F12)
# 6. Click "Claim Tokens" button
# 7. Check console for:
#    "💰 Starting claim for payout..."
#    "✅ Claim data received for X tokens"
# 8. Should see alert with claim data (temporary)
```

### Phase 4: Smart Contract Integration (TODO)
```javascript
// This is a placeholder - thirdweb SDK integration needed
// Current code shows alert with claim data
// Next step: Actual contract call
```

---

## 🔄 How It Works

### Admin Approves Bounty:
```
1. Admin clicks "Approve" in dashboard
2. Backend creates payout record
3. Backend generates cryptographic signature
4. Payout status → 'claimable'
5. Ambassador can claim immediately!
```

### Ambassador Claims Payout:
```
1. Ambassador sees "Claim Tokens" button
2. Clicks button
3. Frontend fetches claim data from API
4. Frontend calls smart contract (TODO)
5. Contract verifies signature
6. Tokens transferred to ambassador
7. Status → 'completed'
```

---

## 🔧 Next Steps

### Immediate (Required):
1. ⚠️ **Run database migration** (see above)
2. ⚠️ **Add environment variables** (see above)
3. ⚠️ **Test signature generation** (Phase 2 above)
4. ⚠️ **Test claim API** (Phase 3 above)

### Future (Enhancement):
1. 🔄 **Add thirdweb contract integration** in `handleClaimPayout`
2. 🔄 **Add event listener** for on-chain claims
3. 🔄 **Auto-update payout status** when claimed
4. 🔄 **Add claim history** to dashboard

---

## 🐛 Troubleshooting

### "No claim signature" error:
- Check: `ADMIN_WALLET_PRIVATE_KEY` is set
- Check: Signature service logs in console
- Solution: Re-approve the bounty to regenerate

### "Signature expired" error:
- Check: `claim_deadline` in database
- Default: 30 days from approval
- Solution: Contact admin to regenerate signature

### "Payout not found" error:
- Check: User is authenticated
- Check: Payout belongs to correct ambassador
- Check: RLS policies are set up correctly

### Database connection errors:
- Check: Migration was run successfully
- Check: All new columns exist in `ambassador_payouts`
- Check: `payout_claim_events` table exists

---

## 📊 Database Schema Changes

### `ambassador_payouts` table:
```sql
+ claim_signature TEXT         -- Cryptographic signature
+ claim_deadline TIMESTAMP      -- Expiration (30 days)
+ claimed_at TIMESTAMP         -- When claimed
+ claim_transaction_hash TEXT  -- Blockchain tx hash
```

### `payout_claim_events` table (NEW):
```sql
id UUID                    -- Unique ID
payout_id UUID            -- Links to ambassador_payouts
user_fid TEXT             -- Ambassador FID
wallet_address TEXT       -- Claiming wallet
signature_used TEXT       -- Signature used
transaction_hash TEXT     -- Blockchain tx
status TEXT               -- Event status
error_message TEXT        -- If failed
ip_address TEXT           -- For security
created_at TIMESTAMP      -- Event time
```

---

## 🎯 Success Criteria

**System is working when:**
- ✅ Bounty approval generates claim signature
- ✅ Payout status changes to 'claimable'
- ✅ Ambassador sees claim button
- ✅ Claim data API returns signature
- ✅ No errors in logs
- ✅ Database events are logged

**Ready for production when:**
- ✅ All above criteria met
- ✅ Smart contract integration complete
- ✅ Tested with real ambassador
- ✅ Event listener updating statuses
- ✅ Error handling tested

---

## 📞 Support

**If you encounter issues:**
1. Check Vercel logs for backend errors
2. Check browser console for frontend errors
3. Check Supabase logs for database errors
4. Verify all environment variables are set
5. Verify database migration ran successfully

---

**Built:** Nov 13, 2025  
**Status:** ✅ Code Complete - Ready for Database Migration

