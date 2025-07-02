# Minted Merch Mini App

A complete Farcaster Mini App for crypto merchandise with USDC payments, automated notifications, discount systems, and comprehensive order management. Built for the Base blockchain ecosystem.

## 🌟 Features

### 🛍️ **E-commerce Core**
- **Shopify Integration**: Full product catalog, inventory management, and order fulfillment
- **USDC Payments**: Native Base blockchain payments with automatic verification
- **Cart Management**: Persistent shopping cart with real-time calculations
- **Shipping Integration**: Real-time shipping rates and address validation
- **Tax Calculation**: Automatic tax computation based on shipping address

### 🎯 **Farcaster Integration**
- **Native Mini App**: Seamless integration with Farcaster protocol
- **Frame Authentication**: Secure user authentication via Farcaster
- **Dynamic Order Sharing**: Smart cast generation with product images
- **Mini App Embeds**: Rich order confirmation cards with real product visuals
- **Social Sharing**: Built-in viral sharing mechanisms
- **User Profiles**: Automatic profile creation and management

### 🔔 **Smart Notifications**
- **Order Confirmations**: Instant payment confirmation notifications
- **Shipping Updates**: Automated tracking notifications with carrier links
- **Welcome Messages**: New user onboarding with discount codes
- **Delivery Tracking**: Real-time shipment status updates

### 💰 **Advanced Discount System**
- **Token-Gated Discounts**: NFT/token-based eligibility with automatic verification
- **Shared Discount Codes**: Multi-user codes with per-user usage limits
- **Product-Specific Targeting**: Discounts for specific products or collections
- **Priority-Based Selection**: Automatic best discount determination
- **First Order Discounts**: 15% off welcome discounts for new users
- **Unique Code Generation**: Cryptographically secure discount codes
- **Comprehensive Usage Tracking**: Prevents duplicate usage and fraud prevention
- **Real-time Validation**: Instant eligibility checking with blockchain verification
- **Analytics Dashboard**: Detailed discount performance and usage statistics

### 📊 **Order Management**
- **Dual Database System**: Shopify for fulfillment, Supabase for notifications
- **Webhook Integration**: Real-time sync between Shopify and internal database
- **Archive Handling**: Proper order archiving without data loss
- **Status Tracking**: Complete order lifecycle management

### 🔐 **Security & Reliability**
- **Transaction Verification**: On-chain payment verification
- **Webhook Security**: HMAC signature verification for all webhooks
- **Rate Limiting**: Protection against abuse and spam
- **Error Handling**: Comprehensive error tracking and recovery

## 🛠️ Tech Stack

### **Frontend**
- **Next.js 14**: React framework with App Router
- **TailwindCSS**: Utility-first CSS framework
- **Wagmi**: React hooks for Ethereum interactions
- **Viem**: TypeScript interface for Ethereum

### **Backend**
- **Supabase**: PostgreSQL database with real-time features
- **Shopify Admin API**: E-commerce backend and fulfillment
- **Neynar API**: Farcaster protocol integration
- **Cloudflare KV**: High-performance caching layer

### **Blockchain**
- **Base Network**: Layer 2 Ethereum scaling solution
- **USDC**: Native stablecoin payments
- **Smart Contract Integration**: Direct on-chain interactions

### **External Services**
- **Google Maps API**: Address autocomplete and validation
- **Carrier APIs**: Real-time shipping rate calculation
- **Webhook Infrastructure**: Event-driven architecture

## 🎫 **Token-Gated Discount System**

### **Overview**
Our advanced discount system supports both traditional codes and sophisticated token-gated discounts that automatically verify user eligibility based on blockchain holdings, NFT ownership, or whitelist membership.

### **Discount Types**

#### **🔐 Token-Gated Discounts**
Discounts that require users to hold specific NFTs, tokens, or meet blockchain-based criteria:
- **NFT Holding**: Verify ownership of specific NFT collections
- **Token Balance**: Require minimum token balances
- **Whitelist-Based**: FID or wallet address whitelisting
- **Combined Criteria**: Multiple requirements with flexible logic

#### **👥 Shared Discount Codes**
Multi-user codes with sophisticated usage tracking:
- **Per-User Limits**: Each user can use the code once
- **Total Usage Caps**: Global usage limits across all users  
- **Usage Tracking**: Comprehensive audit trail per user
- **Fraud Prevention**: IP tracking and abuse detection

#### **👤 User-Specific Codes**
Traditional codes tied to individual users:
- **Welcome Discounts**: First-order incentives
- **Referral Codes**: User-specific promotional codes
- **One-Time Use**: Single-use validation

### **Database Schema**

#### **Core Tables**
```sql
-- Main discount codes table
discount_codes (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE,
  discount_type TEXT, -- 'percentage' | 'fixed'
  discount_value DECIMAL,
  
  -- Token-gating configuration
  gating_type TEXT, -- 'none' | 'nft_holding' | 'token_balance' | 'whitelist_wallet' | 'whitelist_fid' | 'combined'
  contract_addresses JSONB, -- Array of contract addresses to check
  chain_ids JSONB, -- Supported blockchain networks
  required_balance DECIMAL, -- Minimum token/NFT balance
  whitelisted_wallets JSONB, -- Eligible wallet addresses
  whitelisted_fids JSONB, -- Eligible Farcaster IDs
  
  -- Scope and targeting  
  discount_scope TEXT, -- 'site_wide' | 'product' | 'collection'
  target_products JSONB, -- Product IDs for product-specific discounts
  target_collections JSONB, -- Collection IDs
  
  -- Usage limits
  max_uses_total INTEGER, -- Total uses across all users
  max_uses_per_user INTEGER DEFAULT 1, -- Uses per individual user
  current_total_uses INTEGER DEFAULT 0, -- Current usage count
  
  -- Shared code support
  is_shared_code BOOLEAN DEFAULT FALSE, -- Multi-user vs user-specific
  fid INTEGER REFERENCES profiles(fid), -- Owner (NULL for shared codes)
  
  -- Priority and stacking
  priority_level INTEGER DEFAULT 0, -- Higher priority wins conflicts
  stackable_with_other_discounts BOOLEAN DEFAULT FALSE,
  auto_apply BOOLEAN DEFAULT FALSE, -- Auto-apply if eligible
  
  -- Metadata
  expires_at TIMESTAMP,
  campaign_id TEXT, -- Group related discounts
  discount_description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking for shared codes
discount_code_usage (
  id UUID PRIMARY KEY,
  discount_code_id UUID REFERENCES discount_codes(id),
  fid INTEGER REFERENCES profiles(fid),
  order_id TEXT,
  discount_amount DECIMAL,
  original_subtotal DECIMAL,
  used_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(discount_code_id, fid) -- One use per user per code
);
```

### **API Integration**

#### **Enhanced Products API**
Get products with discount information in a single call:
```javascript
// GET /api/shopify/products?handle=fren-trunks&fid=466111
{
  "id": "gid://shopify/Product/8297501589785",
  "title": "Fren Trunks",
  "price": "59.97",
  "availableDiscounts": {
    "best": {
      "code": "FRENWHALE50",
      "value": 50,
      "scope": "product", 
      "displayText": "50% off",
      "isTokenGated": true,
      "gatingType": "nft_holding",
      "priorityLevel": 12
    },
    "alternatives": [
      {
        "code": "WELCOME15",
        "value": 15,
        "scope": "site_wide",
        "displayText": "15% welcome discount"
      }
    ]
  }
}
```

#### **Discount Validation API**
```javascript
// POST /api/validate-discount
{
  "code": "FRENWHALE50",
  "fid": 466111,
  "subtotal": 59.97
}

// Response
{
  "success": true,
  "isValid": true,
  "code": "FRENWHALE50",
  "discountType": "percentage",
  "discountValue": 50,
  "discountAmount": 29.99,
  "isSharedCode": false,
  "requiresAuth": true
}
```

### **Configuration Examples**

#### **NFT-Gated Discount**
```sql
INSERT INTO discount_codes (
  code, discount_type, discount_value,
  gating_type, contract_addresses, chain_ids, required_balance,
  discount_scope, target_products,
  priority_level, auto_apply, expires_at
) VALUES (
  'FRENWHALE50', 'percentage', 50,
  'nft_holding', '["0x1234..."]', '[1, 8453]', 1,
  'product', '[2]', -- Fren Trunks product ID
  12, true, NOW() + INTERVAL '30 days'
);
```

#### **Shared Promotional Code**
```sql
INSERT INTO discount_codes (
  code, discount_type, discount_value,
  is_shared_code, fid, max_uses_total, max_uses_per_user,
  discount_scope, priority_level
) VALUES (
  'PROMO50', 'percentage', 50,
  true, null, 100, 1, -- 100 total uses, 1 per user
  'site_wide', 5
);
```

#### **Whitelist-Based Discount**
```sql
INSERT INTO discount_codes (
  code, discount_type, discount_value,
  gating_type, whitelisted_fids,
  discount_scope, auto_apply
) VALUES (
  'VIP20', 'percentage', 20,
  'whitelist_fid', '[466111, 123456, 789012]',
  'site_wide', true -- Auto-apply for VIP users
);
```

### **Frontend Integration**

#### **Automatic Discount Display**
Product pages automatically show available discounts:
```javascript
// Product page automatically fetches and displays best discount
useEffect(() => {
  if (farcasterUser?.fid && isReady) {
    fetch(`/api/shopify/products?handle=${handle}&fid=${farcasterUser.fid}`)
      .then(res => res.json())
      .then(data => {
        if (data.availableDiscounts?.best) {
          setDisplayedDiscount(data.availableDiscounts.best);
        }
      });
  }
}, [isReady, farcasterUser?.fid]);
```

#### **Cart Integration**
Best discounts are automatically applied:
```javascript
// Cart automatically uses pre-calculated discounts from session storage
const activeDiscount = sessionStorage.getItem('activeDiscountCode');
if (activeDiscount) {
  const discount = JSON.parse(activeDiscount);
  // Apply discount automatically during checkout
}
```

### **Usage Tracking & Analytics**

#### **Per-User Usage Tracking**
For shared codes, each user's usage is tracked individually:
- **Prevents Reuse**: Unique constraint ensures one use per user
- **Audit Trail**: Complete record of who used what when
- **Fraud Detection**: IP and user agent tracking

#### **Analytics Queries**
```sql
-- Most popular discount codes
SELECT code, COUNT(*) as uses, SUM(discount_amount) as total_savings
FROM discount_code_usage dcu
JOIN discount_codes dc ON dcu.discount_code_id = dc.id
GROUP BY code ORDER BY uses DESC;

-- Token-gated discount performance
SELECT code, discount_description, 
       COUNT(*) as uses,
       AVG(discount_amount) as avg_discount
FROM discount_codes dc
LEFT JOIN discount_code_usage dcu ON dc.id = dcu.discount_code_id  
WHERE gating_type != 'none'
GROUP BY code, discount_description;

-- User discount usage patterns
SELECT fid, COUNT(DISTINCT discount_code_id) as unique_codes_used,
       SUM(discount_amount) as total_savings
FROM discount_code_usage
GROUP BY fid ORDER BY total_savings DESC;
```

### **Testing & Debug Endpoints**

#### **Shared Discount Test Suite**
```bash
# Comprehensive test of shared discount functionality
curl "https://your-app.vercel.app/api/debug/shared-discount-test"
```

#### **Token-Gated Eligibility Check**
```bash
# Test NFT/token eligibility for specific user
curl "https://your-app.vercel.app/api/check-token-gated-eligibility" \
  -X POST -H "Content-Type: application/json" \
  -d '{"fid": 466111, "discountCode": "FRENWHALE50"}'
```

#### **Manual Testing Scenarios**
1. **Token-Gated Flow**: User with NFT gets 50% discount
2. **Shared Code Usage**: Multiple users use `PROMO50` once each
3. **Priority Testing**: Best discount automatically selected
4. **Usage Limits**: Code blocked after reaching max uses
5. **Cross-User Validation**: User-specific codes blocked for wrong users

### **Benefits**

#### **For Users**
- **Automatic Eligibility**: No need to hunt for codes
- **Best Price Guarantee**: Always get the highest available discount
- **Seamless Experience**: Discounts appear automatically on product pages
- **Fair Usage**: Shared codes with per-user limits prevent abuse

#### **For Merchants**
- **Targeted Marketing**: NFT/token holder exclusive offers
- **Fraud Prevention**: Comprehensive usage tracking and limits
- **Flexible Campaigns**: Product-specific, collection-wide, or site-wide discounts
- **Analytics**: Detailed insights into discount performance and user behavior

#### **For Developers**
- **Single API Call**: Product data + discount info in one request
- **Flexible Configuration**: Support for any token-gating scenario
- **Comprehensive Testing**: Debug endpoints for all scenarios
- **Future-Proof**: Extensible schema for new gating types

## 📋 Prerequisites

- **Shopify Store**: Admin API access with fulfillment permissions
- **Supabase Account**: PostgreSQL database setup
- **Neynar API Key**: Farcaster protocol integration
- **Base Network**: Wallet setup for USDC transactions
- **Cloudflare Account**: KV storage for caching (optional)

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/SVVVG3/minted-merch-mini-app.git
cd minted-merch-mini-app
npm install
```

### 2. Environment Configuration
Create `.env.local` with the following variables:

```env
# Shopify Configuration
SHOPIFY_SITE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
TARGET_COLLECTION_HANDLE=crypto-merch

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Neynar API (Farcaster)
NEYNAR_API_KEY=your-neynar-api-key

# Payment Configuration
PAYMENT_RECIPIENT_ADDRESS=0xYourWalletAddress
NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS=0xYourWalletAddress

# Optional Services
GOOGLE_MAPS_API_KEY=your-google-maps-key
CLOUDFLARE_KV_NAMESPACE_ID=your-kv-namespace
CLOUDFLARE_KV_API_TOKEN=your-kv-token
```

### 3. Database Setup
```bash
# Apply the main database schema
psql -h your-supabase-host -U postgres -d postgres -f database/schema.sql

# Apply token-gated discount enhancements
psql -h your-supabase-host -U postgres -d postgres -f database/migrations/add_token_gated_discounts.sql

# Apply shared discount code usage tracking
psql -h your-supabase-host -U postgres -d postgres -f database/migrations/add_discount_usage_tracking.sql

# Or run all migrations at once
npm run db:migrate
```

### 4. Webhook Configuration
```bash
# Set up Shopify webhooks
curl -X POST "https://your-app.vercel.app/api/shopify/setup-webhook"
curl -X POST "https://your-app.vercel.app/api/shopify/setup-order-webhook"
```

### 5. Run Development Server
```bash
npm run dev
```

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/                    # API routes
│   │   │   ├── debug/              # Testing endpoints
│   │   │   ├── orders/             # Order management
│   │   │   ├── shopify/            # Shopify integration
│   │   │   └── webhook/            # Webhook handlers
│   │   ├── product/[handle]/       # Product pages
│   │   └── page.js                 # Homepage
│   ├── components/                 # React components
│   │   ├── Cart.jsx                # Shopping cart
│   │   ├── CheckoutFlow.jsx        # Payment flow
│   │   ├── OrderHistory.jsx        # User orders
│   │   └── ProductGrid.jsx         # Product display
│   ├── lib/                        # Core utilities
│   │   ├── discounts.js            # Discount system
│   │   ├── frame.js                # Farcaster integration
│   │   ├── neynar.js               # Notifications
│   │   ├── orders.js               # Order management
│   │   ├── payment.js              # USDC payments
│   │   ├── shopify.js              # Shopify API
│   │   └── supabase.js             # Database client
│   └── styles/                     # Styling
├── database/
│   └── schema.sql                  # Database schema
├── docs/                           # Documentation
└── public/                         # Static assets
```

## 🔧 Configuration Guide

### Shopify Setup
1. **Create Private App** in Shopify Admin
2. **Enable Admin API** with these permissions:
   - `read_products, write_products`
   - `read_orders, write_orders`
   - `read_fulfillments, write_fulfillments`
3. **Configure Webhooks** for order updates and fulfillments

### Supabase Setup
1. **Create Project** on Supabase
2. **Apply Schema** from `database/schema.sql`
3. **Configure RLS** policies for security
4. **Set up Authentication** (optional for admin features)

### Neynar Setup
1. **Get API Key** from Neynar Dashboard
2. **Configure Webhook** for notification delivery
3. **Test Notifications** with debug endpoints

### Payment Setup
1. **Deploy to Base Mainnet** or Sepolia testnet
2. **Configure Wallet** for receiving USDC
3. **Test Payments** with small amounts first

## 🖼️ Dynamic Order Sharing System

### **Smart Product Image Integration**
Our Farcaster Mini App embeds feature dynamic product images that automatically display the actual purchased items instead of generic placeholders.

### **Technical Implementation**

#### **Image Storage Strategy**
- **Order Creation**: Product image URLs are captured and stored directly in order data during checkout
- **Database Storage**: Each line item includes `imageUrl` field from cart context
- **Fallback System**: Graceful degradation to Minted Merch logo if images fail

#### **Share Button Architecture**
```javascript
// Clean URL generation without double encoding
const cleanOrderNumber = orderDetails.name.replace('#', '');
const orderUrl = `${window.location.origin}/order/${cleanOrderNumber}?t=${timestamp}`;
```

#### **OG Image Generation**
- **Dynamic Rendering**: Real-time image composition using Canvas API
- **Product Integration**: Fetches stored product images from order data
- **Cache Busting**: Timestamp-based cache invalidation for immediate sharing
- **Error Handling**: Comprehensive fallback logic for failed image fetches

#### **Key Technical Challenges Solved**
1. **Double URL Encoding**: Fixed `encodeURIComponent()` causing `%23%25231202` instead of `%231202`
2. **Fragment Identifier Issues**: Removed `#` symbols from share URLs to prevent routing conflicts
3. **Timing Synchronization**: Cache-busting ensures fresh images for immediate post-purchase shares
4. **Image Reliability**: Stored URLs during order creation instead of complex GraphQL fetching

#### **URL Architecture**
- **Share Button**: `https://mintedmerch.vercel.app/order/1202?t=1751161234567`
- **Manual Casts**: `https://mintedmerch.vercel.app/order/1202`
- **OG Images**: `/api/og/order?orderNumber=1202&image=https://cdn.shopify.com/...&t=...`

### **Visual Results**
- ✅ **Product Images**: Actual purchased items displayed in Mini App embeds
- ✅ **Order Details**: Clean order numbers, item counts, and payment status
- ✅ **Consistent Experience**: Share button and manual casts show identical results
- ✅ **Performance**: Sub-5-second image generation with fallback handling

## 🧪 Testing

### Debug Endpoints
- `/api/debug/discount-test` - Test basic discount system
- `/api/debug/shared-discount-test` - Test shared discount codes with per-user limits
- `/api/debug/token-gated-test` - Test NFT/token-based discount eligibility
- `/api/debug/order-items-test` - Test order processing
- `/api/debug/test-order-archiving` - Test archiving logic
- `/api/debug/neynar-test` - Test notifications
- `/api/debug/og-order-debug` - Test dynamic image generation

### Manual Testing
```bash
# Test basic discount creation
curl "https://your-app.vercel.app/api/debug/welcome-discount-test"

# Test shared discount codes
curl "https://your-app.vercel.app/api/debug/shared-discount-test"

# Test token-gated discount eligibility
curl "https://your-app.vercel.app/api/debug/token-gated-test"

# Test discount validation
curl -X POST "https://your-app.vercel.app/api/validate-discount" \
  -H "Content-Type: application/json" \
  -d '{"code": "FRENWHALE50", "fid": 466111, "subtotal": 59.97}'

# Test enhanced products API with discounts
curl "https://your-app.vercel.app/api/shopify/products?handle=fren-trunks&fid=466111"

# Test order processing
curl "https://your-app.vercel.app/api/debug/order-processing-test"

# Test notifications
curl "https://your-app.vercel.app/api/debug/test-shipping-notification"
```

## 📊 Analytics & Monitoring

### Built-in Analytics
- **Order Metrics**: Revenue, conversion rates, average order value
- **Discount Usage**: Code performance and fraud detection
- **User Behavior**: Cart abandonment and purchase patterns
- **Notification Delivery**: Success rates and engagement

### Database Queries
```sql
-- Revenue analytics
SELECT SUM(amount_total) FROM orders WHERE status = 'shipped';

-- Discount performance
SELECT discount_code, COUNT(*), SUM(discount_amount) FROM orders 
WHERE discount_code IS NOT NULL GROUP BY discount_code;

-- User engagement
SELECT COUNT(DISTINCT fid) FROM orders WHERE created_at > NOW() - INTERVAL '30 days';
```

## 🚀 Deployment

### Vercel (Recommended)
1. **Connect Repository** to Vercel
2. **Add Environment Variables** from your `.env.local`
3. **Deploy** with automatic CI/CD

### Custom Deployment
```bash
# Build for production
npm run build

# Start production server
npm start
```

### Post-Deployment
1. **Configure Webhooks** with your production URL
2. **Test Payment Flow** with real USDC transactions
3. **Monitor Logs** for any issues

## 🔐 Security Considerations

### API Security
- **Webhook Verification**: All Shopify webhooks are HMAC verified
- **Rate Limiting**: Built-in protection against abuse
- **Input Validation**: Comprehensive data sanitization

### Payment Security
- **On-chain Verification**: All payments verified on Base blockchain
- **Address Validation**: Recipient address verification
- **Amount Verification**: Exact payment amount checking

### Data Protection
- **RLS Policies**: Row-level security in Supabase
- **API Key Management**: Secure environment variable handling
- **User Privacy**: Minimal data collection and retention

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Test** thoroughly with debug endpoints
4. **Submit** a pull request with detailed description

## 📚 Documentation

- **API Reference**: `/docs/API.md`
- **Database Schema**: `/docs/DATABASE.md`
- **Webhook Guide**: `/docs/WEBHOOKS.md`
- **Deployment Guide**: `/docs/DEPLOYMENT.md`

## 🐛 Troubleshooting

### Common Issues
- **Payment Failures**: Check Base network status and gas fees
- **Webhook Errors**: Verify HMAC secrets and endpoint URLs
- **Notification Issues**: Check Neynar API key and rate limits
- **Database Errors**: Verify Supabase connection and RLS policies

### Debug Tools
- **Health Check**: `/api/debug/env-test`
- **Database Test**: `/api/debug/supabase-test`
- **Payment Test**: `/api/debug/checkout-test`

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **@jc4p** for the starter repo
- **Farcaster Team** for the Mini App framework
- **Shopify** for the comprehensive e-commerce API
- **Base Team** for the scalable L2 infrastructure
- **Supabase** for the real-time database platform

---

Vibe Coded with ❤️ by @SVVVG3.eth for the Farcaster and Base ecosystems
