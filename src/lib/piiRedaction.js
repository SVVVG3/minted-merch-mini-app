/**
 * PII Redaction Utilities
 * 
 * OWASP Best Practice: Never log or display full PII (Personally Identifiable Information)
 * This module provides utilities to redact sensitive data for logging and display purposes.
 * 
 * Use these functions EVERYWHERE you log customer data!
 */

/**
 * Redact shipping address for logging
 * Shows only city/state for debugging, hides street address
 * 
 * @param {Object} address - Full shipping address
 * @returns {Object} Redacted address safe for logging
 * 
 * @example
 * console.log('Address:', redactAddressForLog(shippingAddress));
 * // Output: { city: 'Los Angeles', province: 'CA', country: 'US', zip: '916**' }
 */
export function redactAddressForLog(address) {
  if (!address) return null;
  
  return {
    city: address.city || '[redacted]',
    province: address.province || address.state || '[redacted]',
    country: address.country || '[redacted]',
    zip: address.zip ? redactZipCode(address.zip) : '[redacted]',
    // NEVER log: firstName, lastName, address1, address2, phone, email
  };
}

/**
 * Redact ZIP code - show first 3 digits only
 * 
 * @param {string} zip - Full ZIP code
 * @returns {string} Partially redacted ZIP (e.g., "916**")
 */
export function redactZipCode(zip) {
  if (!zip || zip.length < 3) return '***';
  return zip.substring(0, 3) + '*'.repeat(Math.max(2, zip.length - 3));
}

/**
 * Redact email address for logging
 * Shows only first char + domain
 * 
 * @param {string} email - Full email address
 * @returns {string} Redacted email (e.g., "d***@gmail.com")
 */
export function redactEmail(email) {
  if (!email || !email.includes('@')) return '[redacted]';
  
  const [localPart, domain] = email.split('@');
  return `${localPart[0]}${'*'.repeat(Math.max(3, localPart.length - 1))}@${domain}`;
}

/**
 * Redact phone number for logging
 * Shows only last 4 digits
 * 
 * @param {string} phone - Full phone number
 * @returns {string} Redacted phone (e.g., "***-***-1234")
 */
export function redactPhone(phone) {
  if (!phone) return '[redacted]';
  
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  
  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

/**
 * Redact customer name for logging
 * Shows first initial + last initial only
 * 
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {string} Redacted name (e.g., "D. S.")
 */
export function redactName(firstName, lastName) {
  const first = firstName ? `${firstName[0]}.` : '[?]';
  const last = lastName ? `${lastName[0]}.` : '[?]';
  return `${first} ${last}`;
}

/**
 * Redact entire shipping address object for partner view
 * Partners should only see city/state, not full address
 * 
 * @param {Object} address - Full shipping address
 * @returns {Object} Partner-safe address (city, state, partial ZIP only)
 */
export function redactAddressForPartner(address) {
  if (!address) return null;
  
  return {
    city: address.city || null,
    province: address.province || address.state || null,
    country: address.country || null,
    zip: address.zip ? redactZipCode(address.zip) : null,
    // Partners don't need: firstName, lastName, address1, address2, phone
  };
}

/**
 * Create a safe order object for logging
 * Removes all PII, keeps only IDs and status
 * 
 * @param {Object} order - Full order object
 * @returns {Object} Safe order for logging
 * 
 * @example
 * console.log('Order created:', redactOrderForLog(order));
 */
export function redactOrderForLog(order) {
  return {
    id: order.id,
    order_id: order.order_id,
    orderId: order.orderId,
    fid: order.fid,
    order_status: order.order_status,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    total: order.total,
    created_at: order.created_at,
    // Redacted fields
    customer_name: order.customer_name ? redactName(
      order.customer_name.split(' ')[0],
      order.customer_name.split(' ').slice(1).join(' ')
    ) : '[redacted]',
    customer_email: order.customer_email ? redactEmail(order.customer_email) : '[redacted]',
    shipping_address: order.shipping_address ? redactAddressForLog(order.shipping_address) : null,
  };
}

/**
 * Check if we're in production environment
 * Used to determine if extra redaction is needed
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production' 
      || process.env.VERCEL_ENV === 'production';
}

/**
 * Safe console.log that automatically redacts PII
 * Use this instead of console.log for customer data
 * 
 * @param {string} message - Log message
 * @param {Object} data - Data to log (will be auto-redacted if contains PII)
 * 
 * @example
 * safeLog('Processing order', { shippingAddress, customerEmail });
 */
export function safeLog(message, data) {
  if (!data) {
    console.log(message);
    return;
  }
  
  // Auto-detect and redact common PII fields
  const safeData = { ...data };
  
  if (safeData.shippingAddress) {
    safeData.shippingAddress = redactAddressForLog(safeData.shippingAddress);
  }
  
  if (safeData.shipping_address) {
    safeData.shipping_address = redactAddressForLog(safeData.shipping_address);
  }
  
  if (safeData.customerEmail) {
    safeData.customerEmail = redactEmail(safeData.customerEmail);
  }
  
  if (safeData.customer_email) {
    safeData.customer_email = redactEmail(safeData.customer_email);
  }
  
  if (safeData.phone) {
    safeData.phone = redactPhone(safeData.phone);
  }
  
  console.log(message, safeData);
}

/**
 * Audit log entry creator
 * Creates structured audit log for shipping address access
 * 
 * @param {Object} params - Audit log parameters
 * @param {string} params.orderId - Order ID
 * @param {number} params.fid - User FID (if customer)
 * @param {string} params.role - User role (customer/admin/partner)
 * @param {string} params.accessType - Access type (view/update/export)
 * @param {string} params.ipAddress - IP address
 * @param {string} params.userAgent - User agent string
 * @returns {Object} Audit log entry
 */
export function createAuditLogEntry({
  orderId,
  fid = null,
  role,
  accessType,
  ipAddress = null,
  userAgent = null
}) {
  return {
    order_id: orderId,
    accessed_by_fid: fid,
    accessed_by_role: role,
    access_type: accessType,
    accessed_at: new Date().toISOString(),
    ip_address: ipAddress,
    user_agent: userAgent
  };
}

/**
 * Validate that an address doesn't contain sensitive data in wrong fields
 * Sometimes developers accidentally log PII - this catches that
 * 
 * @param {Object} obj - Object to validate
 * @returns {boolean} True if object contains potential PII
 */
export function containsPII(obj) {
  if (!obj || typeof obj !== 'object') return false;
  
  const piiFields = [
    'firstName', 'lastName', 'first_name', 'last_name',
    'address1', 'address2', 'address_1', 'address_2',
    'phone', 'email', 'ssn', 'creditCard', 'credit_card'
  ];
  
  const objKeys = Object.keys(obj);
  return piiFields.some(field => objKeys.includes(field));
}

/**
 * Assert that we're not accidentally logging PII
 * Throws error in development if PII detected in logs
 * 
 * @param {Object} obj - Object to check
 * @param {string} context - Context description for error message
 */
export function assertNoPII(obj, context = 'log') {
  if (isProduction()) return; // Only check in dev
  
  if (containsPII(obj)) {
    console.error(`❌ PII DETECTED IN ${context}:`, Object.keys(obj));
    console.error('Use redaction functions before logging!');
    console.error('Detected fields:', Object.keys(obj).filter(k => 
      ['firstName', 'lastName', 'address1', 'address2', 'phone', 'email'].includes(k)
    ));
    
    // In development, throw error to catch the mistake
    throw new Error(`PII detected in ${context}! Use redaction functions.`);
  }
}

// Export all functions
export default {
  redactAddressForLog,
  redactZipCode,
  redactEmail,
  redactPhone,
  redactName,
  redactAddressForPartner,
  redactOrderForLog,
  isProduction,
  safeLog,
  createAuditLogEntry,
  containsPII,
  assertNoPII
};

