# ⚡ QUICK DEPLOYMENT - DO THIS NOW!

## 🔐 Step 1: Add to Vercel (5 minutes)

1. **Go to Vercel**: https://vercel.com/dashboard
2. **Select your project**
3. **Go to**: Settings → Environment Variables
4. **Add Variable #1**:
   - Name: `JWT_SECRET`
   - Value: `ab4YPMvjzKM4ItqtieI2D+CwdZMI90/TezuuZj25CpQ=`
   - Environments: ✅ Production ✅ Preview ✅ Development
   - Click **Save**

5. **Add Variable #2**:
   - Name: `ADMIN_PASSWORD`
   - Value: `[Choose a strong password - write it down!]`
   - Example: `MintedMerch2025!SecureAdmin`
   - Environments: ✅ Production ✅ Preview ✅ Development  
   - Click **Save**

## 📦 Step 2: Deploy (Run these commands)

```bash
# Stage all security changes
git add -A

# Commit
git commit -m "SECURITY: Add JWT authentication to all admin and debug endpoints"

# Deploy
git push origin main
```

## ✅ Step 3: Test (2 minutes)

1. **Wait for Vercel deployment** (watch at https://vercel.com/dashboard)
2. **When "Ready"**, visit: https://mintedmerch.vercel.app/admin
3. **Login** with your ADMIN_PASSWORD
4. **Success!** You should see your dashboard with data

## 🎉 WHAT'S NOW SECURED

- ✅ Admin dashboard requires login
- ✅ All 25 admin endpoints require JWT token
- ✅ All 92 debug endpoints require admin auth
- ✅ Tokens expire after 8 hours
- ✅ Invalid tokens auto-rejected

## ⚠️ IMPORTANT REMINDERS

- **SAVE** your `JWT_SECRET`: `ab4YPMvjzKM4ItqtieI2D+CwdZMI90/TezuuZj25CpQ=`
- **WRITE DOWN** your `ADMIN_PASSWORD`
- **DON'T** share these with anyone
- **ROTATE** secrets every 90 days

## 🆘 IF SOMETHING BREAKS

1. Check Vercel environment variables are saved
2. Check both have "Production" selected
3. Clear browser cache and try again
4. Check Vercel deployment logs for errors

---

**Time to Complete**: ~7 minutes  
**Risk Level After**: ✅ SECURE

