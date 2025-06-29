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
- **First Order Discounts**: 15% off welcome discounts for new users
- **Unique Code Generation**: Cryptographically secure discount codes
- **Usage Tracking**: Prevents duplicate usage and fraud
- **Analytics**: Comprehensive discount usage statistics

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
# Run the database migration
npm run db:migrate

# Or manually apply the schema
psql -h your-supabase-host -U postgres -d postgres -f database/schema.sql
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
- `/api/debug/discount-test` - Test discount system
- `/api/debug/order-items-test` - Test order processing
- `/api/debug/test-order-archiving` - Test archiving logic
- `/api/debug/neynar-test` - Test notifications
- `/api/debug/og-order-debug` - Test dynamic image generation

### Manual Testing
```bash
# Test discount creation
curl "https://your-app.vercel.app/api/debug/welcome-discount-test"

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
