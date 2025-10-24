# 🚨 EMERGENCY SECURITY FIXES REQUIRED

## Status: CRITICAL - IMMEDIATE ACTION REQUIRED

### Issues Discovered

1. **Admin Dashboard - FIXED ✅**
   - All 25 admin endpoints now protected with JWT authentication
   - Login now generates JWT tokens
   - AdminDashboard now sends auth tokens with requests

2. **Debug Endpoints - CRITICAL VULNERABILITY 🔴**
   - 70+ debug endpoints are publicly accessible
   - Several use service_role privileges without authentication
   - Anyone can call these and access/modify data

3. **Service Role Key Exposure - HIGH RISK 🟡**
   - Some public endpoints use service_role when user-scoped access would be better
   - Risk of privilege escalation

## IMMEDIATE ACTIONS REQUIRED

### Option 1: Delete All Debug Endpoints (RECOMMENDED)

Debug endpoints should NEVER be in production. Delete the entire `/src/app/api/debug` directory:

```bash
# STRONGLY RECOMMENDED
rm -rf src/app/api/debug
git add -A
git commit -m "SECURITY: Remove all debug endpoints from production"
git push
```

### Option 2: Protect Debug Endpoints with Admin Auth

If you need to keep some debug endpoints:

```javascript
// Add to EVERY debug endpoint
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request) => {
  // ... existing code
});
```

### Option 3: Environment-Based Protection

Only allow debug endpoints in development:

```javascript
// At the top of each debug endpoint
export async function GET(request) {
  // Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 404 }
    );
  }
  
  // ... rest of code
}
```

## FILES TO REVIEW/PROTECT

### Debug Endpoints Using Service Role (HIGHEST PRIORITY)
1. `src/app/api/debug/cleanup-spin/route.js` - Modifies user spin data
2. `src/app/api/debug/discount-eligibility/route.js` - Checks discount eligibility
3. `src/app/api/debug/user-spin-status/route.js` - Views user data
4. `src/app/api/debug/spin-check/route.js` - Accesses spin registry
5. `src/app/api/debug/test-token-balance/route.js` - Queries token balances

### Public Endpoints Using Service Role (REVIEW NEEDED)
1. `src/app/api/spin-permit/route.js` - Should this use service_role?
2. `src/app/api/register-user/route.js` - Review privilege level
3. `src/app/api/update-connected-wallet/route.js` - Review privilege level
4. `src/app/api/webhook/route.js` - Ensure webhook validation

### All Other Debug Endpoints (70+ files)
- Either DELETE or PROTECT with admin auth
- See full list: `ls src/app/api/debug/*/route.js`

## DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] JWT_SECRET added to Vercel environment variables
- [ ] ADMIN_PASSWORD updated to strong password
- [ ] All debug endpoints removed OR protected
- [ ] Service role usage reviewed in public endpoints
- [ ] Git history checked for leaked secrets
- [ ] .env files NOT committed to repo
- [ ] Admin dashboard tested with JWT auth
- [ ] Existing admin sessions invalidated (change JWT_SECRET)

## VERIFICATION STEPS

After deploying fixes:

```bash
# Test that debug endpoints are inaccessible
curl https://mintedmerch.vercel.app/api/debug/cleanup-spin
# Should return 404 or 401

# Test admin login works
curl -X POST https://mintedmerch.vercel.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"test"}'
# Should return token if password correct

# Test admin endpoint without auth fails
curl https://mintedmerch.vercel.app/api/admin/orders
# Should return 401 Unauthorized

# Test admin endpoint with auth works
curl https://mintedmerch.vercel.app/api/admin/orders \
  -H "Authorization: Bearer YOUR_TOKEN"
# Should return data if token valid
```

## DAMAGE ASSESSMENT

If your security auditor found these issues, assume:

1. **Admin Dashboard**: Likely accessed - review admin logs
2. **Debug Endpoints**: Potentially discovered - check for unusual API calls
3. **Data Exposure**: Customer data (names, emails, addresses, orders) may have been viewed
4. **Discount Codes**: Unlimited discount codes could have been created

## RECOVERY STEPS

1. **Immediately deploy fixes** (admin auth + remove debug endpoints)
2. **Rotate all API keys**:
   - Generate new JWT_SECRET
   - Change ADMIN_PASSWORD
   - Rotate Shopify API tokens if possible
   - Rotate Supabase service_role key (requires Supabase dashboard)
3. **Review database for anomalies**:
   - Check for 100% discount codes created recently
   - Check for unusual order patterns
   - Check for admin actions you didn't take
4. **Monitor logs** for suspicious activity patterns
5. **Consider notifying users** if customer data was accessed (check compliance requirements)

## LONG-TERM SECURITY IMPROVEMENTS

1. **API Rate Limiting**: Add rate limiting to all endpoints
2. **Request Logging**: Log all admin API calls with timestamps
3. **IP Whitelisting**: Restrict admin access to trusted IPs
4. **2FA for Admin**: Add two-factor authentication
5. **Regular Security Audits**: Schedule quarterly security reviews
6. **Dependency Scanning**: Use `npm audit` regularly
7. **Secret Scanning**: Use tools like `git-secrets` or GitHub secret scanning
8. **Principle of Least Privilege**: Review all service_role usage

## QUESTIONS?

This is a critical security situation. If you need help:

1. Deploy the admin JWT auth fixes immediately (already implemented)
2. Delete or protect debug endpoints (choose Option 1, 2, or 3 above)
3. Rotate all secrets
4. Monitor for abuse

---

**Priority Level**: 🔴 CRITICAL  
**Time to Fix**: < 1 hour  
**Risk Level**: Data breach, unauthorized discounts, admin access

