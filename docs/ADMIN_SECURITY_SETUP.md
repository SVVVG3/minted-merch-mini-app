# Admin Dashboard Security Setup

## 🚨 CRITICAL SECURITY NOTICE

The admin dashboard now requires JWT authentication for all API endpoints. This prevents unauthorized access to sensitive data and operations.

## Environment Variables Required

### JWT_SECRET (REQUIRED)

This is the most critical environment variable for admin security. It's used to sign and verify JWT tokens.

**Generate a secure secret:**

```bash
# On Mac/Linux:
openssl rand -base64 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Add to your environment variables:**

```env
JWT_SECRET=your_generated_secret_here_minimum_32_characters
```

⚠️ **NEVER commit this secret to version control**
⚠️ **Use a different secret for staging and production**
⚠️ **Rotate this secret regularly (every 90 days recommended)**

### ADMIN_PASSWORD (REQUIRED)

The password used to log into the admin dashboard.

```env
ADMIN_PASSWORD=your_secure_password_here
```

**Password Requirements:**
- Minimum 12 characters
- Include uppercase, lowercase, numbers, and special characters
- Don't use dictionary words
- Don't reuse passwords from other services

## Vercel Deployment

### Add Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following:

```
JWT_SECRET = [paste your generated secret]
ADMIN_PASSWORD = [your secure password]
```

4. Make sure to add them for all environments (Production, Preview, Development)

### Redeploy After Adding Secrets

After adding the environment variables:

```bash
vercel --prod
```

Or push to your main branch to trigger automatic deployment.

## Local Development

### Create .env.local

Create a file called `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your secrets:

```env
JWT_SECRET=your_local_development_secret_here
ADMIN_PASSWORD=admin123  # Only for local development
```

### Start Development Server

```bash
npm run dev
```

## How It Works

### 1. Login Flow

1. User enters password in admin dashboard
2. Password is sent to `/api/admin/login`
3. Server validates password and generates JWT token
4. Token is returned to client and stored in `localStorage`

### 2. Authenticated Requests

Every admin API request now:

1. Reads token from `localStorage`
2. Adds token to request headers (`Authorization: Bearer <token>`)
3. Server validates token using `JWT_SECRET`
4. If valid, processes request
5. If invalid/expired, returns 401 and client forces re-login

### 3. Token Expiration

- JWT tokens expire after 8 hours
- After expiration, user must log in again
- Session is automatically cleared on 401 responses

## Protected Endpoints

All endpoints under `/api/admin/*` are now protected except:
- `/api/admin/login` - Login endpoint (requires password)
- `/api/admin/auth` - Legacy auth endpoint

**Protected endpoints include:**
- `/api/admin/discounts` - Discount code management
- `/api/admin/orders` - Order management
- `/api/admin/users` - User data access
- `/api/admin/stats` - Dashboard statistics
- `/api/admin/leaderboard` - Leaderboard data
- `/api/admin/raffle` - Raffle operations
- `/api/admin/partners` - Partner management
- And 18 more admin endpoints

## Security Best Practices

### DO ✅

- Use strong, unique JWT_SECRET (32+ characters)
- Store JWT_SECRET in environment variables only
- Use different secrets for dev/staging/production
- Rotate secrets regularly (every 90 days)
- Use HTTPS in production (Vercel does this automatically)
- Enable 2FA on your Vercel account
- Review admin access logs regularly

### DON'T ❌

- Don't commit JWT_SECRET to git
- Don't share JWT_SECRET via email/chat
- Don't use weak or predictable secrets
- Don't expose tokens in client-side code (except localStorage)
- Don't extend token expiration beyond 24 hours
- Don't grant admin access to untrusted users

## Troubleshooting

### "No authentication token found" Error

**Cause:** Token not in localStorage or was cleared

**Solution:** Log in again through the admin dashboard

### "Session expired" Error

**Cause:** JWT token has expired (>8 hours old)

**Solution:** Log in again - this is normal behavior

### "JWT_SECRET environment variable is not set" Error

**Cause:** Server doesn't have JWT_SECRET configured

**Solution:** 
1. Add JWT_SECRET to your `.env.local` (local dev)
2. Add JWT_SECRET to Vercel environment variables (production)
3. Redeploy

### 401 Errors on All Admin Requests

**Possible causes:**

1. **JWT_SECRET mismatch** - Token was created with different secret than server is using
   - Solution: Log out, log in again to get new token

2. **Clock skew** - Server time is significantly different from client
   - Solution: Check server time settings

3. **Token corruption** - localStorage data was corrupted
   - Solution: Clear localStorage and log in again

## Emergency Response

### If Admin Dashboard is Compromised

1. **Immediately rotate JWT_SECRET** in Vercel environment variables
2. **Change ADMIN_PASSWORD** 
3. **Redeploy** to invalidate all existing tokens
4. **Review admin logs** for suspicious activity
5. **Check database** for unauthorized changes
6. **Notify users** if customer data was accessed

### Recovery Steps

```bash
# 1. Generate new secret
openssl rand -base64 32

# 2. Update Vercel environment variables
# (Do this in Vercel dashboard)

# 3. Redeploy
vercel --prod

# 4. All existing admin sessions are now invalid
# 5. Admin must log in again with new password
```

## Audit Log

To monitor admin access:

```bash
# View Vercel logs
vercel logs

# Filter for admin logins
vercel logs | grep "Admin login"

# Filter for failed login attempts
vercel logs | grep "Failed admin login"
```

## Additional Security Layers

### Consider implementing:

1. **IP Whitelisting** - Restrict admin access to specific IPs
2. **2FA/MFA** - Require second factor for admin login
3. **Audit Logging** - Log all admin actions to database
4. **Rate Limiting** - Prevent brute force password attacks
5. **Session Management** - Track and revoke active sessions
6. **Role-Based Access** - Different permission levels for different admins

## Questions?

If you have questions about admin security:

1. Review this documentation
2. Check the code in `src/lib/adminAuth.js`
3. Test the authentication flow locally
4. Contact your security team if issues persist

---

**Last Updated:** January 2025
**Security Level:** High Priority
**Review Schedule:** Quarterly

