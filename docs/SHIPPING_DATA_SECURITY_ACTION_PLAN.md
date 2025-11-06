# 🔒 Shipping Data Security Action Plan

## Executive Summary
This document outlines CRITICAL security improvements needed to protect customer shipping addresses according to OWASP best practices and compliance requirements (PCI DSS, GDPR, CCPA).

---

## ✅ Current Status: **What's Working**

### 1. ✅ Encryption in Transit
- **Status:** COMPLIANT
- All API traffic uses HTTPS/TLS (Vercel enforces this)
- Supabase connections use TLS 1.2+

### 2. ✅ Logging Practices
- **Status:** GOOD
- No full addresses logged to console
- Only logging order IDs and sanitized names
- Using request IDs for traceability

### 3. ✅ Basic Access Control
- **Status:** PARTIAL
- Admin routes protected with JWT
- RLS enabled on tables
- Service role separated from anon key

---

## 🔴 CRITICAL GAPS TO FIX

### Priority 1: Encryption at Rest (IMMEDIATE)

**Current Issue:**
```sql
shipping_address JSONB, -- Plain text in database
```

**Actions Required:**

1. **Enable Supabase Database Encryption** ⏰ **Do this NOW**
   ```
   Supabase Dashboard → Settings → Database → Enable encryption at rest
   ```
   - Uses AES-256
   - Managed by Supabase's KMS
   - Zero code changes needed

2. **Verify Backup Encryption**
   ```
   Supabase Dashboard → Settings → Backups → Verify encryption enabled
   ```

**Timeline:** Can be done in 5 minutes
**Risk if not fixed:** HIGH - Database breach exposes all addresses

---

### Priority 2: Fix RLS Policies (IMMEDIATE)

**Current Issue:**
```sql
CREATE POLICY "Allow all operations on orders for now" ON orders
  FOR ALL USING (true); -- ❌ ANYONE CAN READ ANY ORDER
```

**Actions Required:**

1. **Apply the security migration**
   ```bash
   # Run the migration
   psql $DATABASE_URL < database/migrations/fix_shipping_data_security.sql
   ```

2. **What this fixes:**
   - ✅ Customers can only see THEIR orders
   - ✅ Admins (service role) have full access
   - ✅ Partners see redacted addresses (city/state only)
   - ✅ Audit logging for compliance

**Timeline:** 10 minutes to apply + test
**Risk if not fixed:** CRITICAL - Data breach vulnerability

---

### Priority 3: MFA for Admin Access (HIGH)

**Current Issue:**
- Admin password is single-factor
- No 2FA enforcement

**Actions Required:**

1. **Add 2FA to admin login**
   - Recommended: Use Supabase Auth with 2FA
   - Alternative: Implement TOTP (Google Authenticator)

2. **Add IP whitelisting** (optional but recommended)
   ```js
   // In adminAuth.js
   const ALLOWED_ADMIN_IPS = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
   ```

**Timeline:** 2-4 hours dev time
**Risk if not fixed:** MEDIUM - Credential compromise risk

---

### Priority 4: Credential Hygiene (MEDIUM)

**Current Status:**
- ✅ JWT tokens expire after 8 hours
- ⚠️ No key rotation policy
- ⚠️ No password complexity requirements

**Actions Required:**

1. **Implement key rotation**
   ```bash
   # Add to .env
   JWT_SECRET_ROTATION_DATE=2025-02-01
   JWT_SECRET_PREVIOUS=<old-secret>
   ```

2. **Add password requirements**
   - Minimum 16 characters
   - Require special chars + numbers
   - Use bcrypt for hashing

**Timeline:** 1-2 hours
**Risk if not fixed:** LOW - But improves security posture

---

### Priority 5: Audit Logging (MEDIUM)

**Current Status:**
- ⚠️ No tracking of who accesses shipping addresses
- ⚠️ No alerts for suspicious access patterns

**Actions Required:**

1. **Implement audit logging** (already created in migration)
   - Track every access to shipping_address field
   - Log IP, user agent, timestamp
   - Alert on bulk exports

2. **Add helper function to API routes**
   ```js
   async function logShippingAddressAccess(orderId, accessType) {
     await supabaseAdmin
       .from('shipping_address_access_log')
       .insert({
         order_id: orderId,
         access_type: accessType,
         accessed_at: new Date().toISOString()
       });
   }
   ```

**Timeline:** 2-3 hours
**Risk if not fixed:** LOW - But required for compliance

---

## 🎯 Additional Best Practices to Implement

### 1. Pseudonymization
**Current:** Order IDs are UUIDs ✅
**Improvement:** Use opaque order numbers in UIs
```js
// Display: #MM-1234 instead of showing UUID
const displayOrderId = `MM-${orderId.slice(0, 8).toUpperCase()}`;
```

### 2. Production Data Separation
**Current:** ⚠️ No separation
**Action:** Create staging environment with anonymized data
```sql
-- Anonymization script for staging
UPDATE orders 
SET shipping_address = jsonb_build_object(
  'firstName', 'Test',
  'lastName', 'User' || id,
  'address1', '123 Test St',
  'city', shipping_address->>'city', -- Keep city for testing
  'province', shipping_address->>'province',
  'country', shipping_address->>'country',
  'zip', '00000'
);
```

### 3. Export Controls
**Current:** ⚠️ No export restrictions
**Action:** Add export rate limiting
```js
// In admin API routes
const MAX_EXPORTS_PER_HOUR = 5;
const MAX_RECORDS_PER_EXPORT = 100;
```

### 4. Data Retention Policy
**Current:** ⚠️ Addresses stored indefinitely
**Action:** Implement retention policy
```sql
-- Auto-delete shipping addresses after 7 years (compliance requirement)
CREATE OR REPLACE FUNCTION archive_old_shipping_addresses()
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET shipping_address = jsonb_build_object(
    'archived', true,
    'archived_at', NOW()
  )
  WHERE created_at < NOW() - INTERVAL '7 years'
  AND shipping_address IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Run monthly
SELECT cron.schedule(
  'archive_old_addresses',
  '0 0 1 * *', -- First day of each month
  'SELECT archive_old_shipping_addresses()'
);
```

---

## 🔐 Security Checklist

### Immediate (Do Today)
- [ ] Enable Supabase database encryption at rest
- [ ] Apply RLS security migration
- [ ] Verify backup encryption is enabled
- [ ] Test order access with different user roles

### This Week
- [ ] Implement MFA for admin login
- [ ] Add audit logging helper functions
- [ ] Set up IP whitelisting for admin access
- [ ] Create pseudonymization for order displays

### This Month
- [ ] Implement key rotation policy
- [ ] Set up staging environment with anonymized data
- [ ] Add export rate limiting
- [ ] Implement data retention policy
- [ ] Security audit by third party

---

## 📊 Compliance Status

| Requirement | Standard | Status | Priority |
|------------|----------|--------|----------|
| Encryption in transit | PCI DSS | ✅ PASS | N/A |
| Encryption at rest | PCI DSS | ⚠️ NEEDS FIX | 🔴 HIGH |
| Access controls | OWASP | ⚠️ NEEDS FIX | 🔴 HIGH |
| Audit logging | GDPR/CCPA | ⚠️ PARTIAL | 🟡 MEDIUM |
| MFA enforcement | NIST | ❌ MISSING | 🟡 MEDIUM |
| Data retention | GDPR | ❌ MISSING | 🟢 LOW |
| Pseudonymization | GDPR | ⚠️ PARTIAL | 🟢 LOW |

---

## 📞 Next Steps

1. **TODAY:** Apply RLS migration and enable database encryption
2. **THIS WEEK:** Implement audit logging and MFA
3. **SCHEDULE:** Monthly security review meeting
4. **DOCUMENT:** Update this checklist as items are completed

---

## 🆘 Emergency Response

**If you suspect a data breach:**

1. **Immediately:**
   - Rotate all API keys and JWT secrets
   - Check audit logs for suspicious access
   - Contact legal team

2. **Within 24 hours:**
   - Notify affected customers (GDPR requirement)
   - File incident report
   - Engage security consultant

3. **Within 72 hours:**
   - Full forensic analysis
   - Implement additional controls
   - Update this document

---

**Last Updated:** 2025-01-06
**Next Review:** 2025-02-06
**Owner:** Engineering Team
**Compliance Officer:** [TBD]

