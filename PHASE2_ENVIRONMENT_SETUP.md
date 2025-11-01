# Phase 2 Environment Variables Setup

## Required Environment Variable

Phase 2 cryptographic authentication requires a `JWT_SECRET` environment variable.

### Add to Vercel (Production)

1. Go to your Vercel dashboard
2. Select your project: **Minted Merch Mini App**
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Name**: `JWT_SECRET`
   - **Value**: `vBOuM2YRHLSGS+BaKS2oF3ti3u9+L22M56TaWGuwT+98B5v2jTXdv/BKBVfpY768bhGxVp4cOdxnBL2i1WgnOQ==`
   - **Environments**: Production, Preview, Development (check all)
5. Click **Save**
6. **IMPORTANT**: Redeploy your app for the changes to take effect

### Add to Local Development (Optional)

If you run the app locally, add to your `.env.local` file:

```
JWT_SECRET=vBOuM2YRHLSGS+BaKS2oF3ti3u9+L22M56TaWGuwT+98B5v2jTXdv/BKBVfpY768bhGxVp4cOdxnBL2i1WgnOQ==
```

---

## What This Does

The `JWT_SECRET` is used to cryptographically sign session tokens:
- When a user authenticates with Farcaster (Mini App or Desktop), we issue them a JWT token
- This token is signed with `JWT_SECRET` so it cannot be forged
- All subsequent API requests include this token in the `Authorization` header
- The backend verifies the signature before processing requests

**This prevents attackers from:**
- Faking authentication (even with public code)
- Accessing other users' data
- Spoofing wallet addresses
- Generating unauthorized chat invitations

---

## Security Notes

1. **Keep this secret!** Never commit it to git (it's in `.gitignore`)
2. **Production-ready**: This 512-bit random secret is cryptographically secure
3. **Rotation**: If compromised, generate a new secret (users will need to re-authenticate)
4. **Backup**: Store securely in your password manager

---

## Verification

After setting the environment variable and redeploying:

1. Open your Mini App
2. Check browser console - you should see: `✅ Session token obtained for Mini App user`
3. Make a request (e.g., view shipping address) - check for: `✅ Authenticated FID from JWT: [your_fid]`

If you see warnings like `⚠️ Authenticated FID from legacy header`, the JWT_SECRET is not set correctly.

