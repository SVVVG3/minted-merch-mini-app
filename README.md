# Minted Merch Mini App

A web app and Farcaster Mini App for crypto merchandise with USDC payments on Base, featuring automated notifications, advanced discount systems, and secure order management.

[![Security](https://img.shields.io/badge/security-A--grade-green)](https://github.com/SVVVG3/minted-merch-mini-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Base Network](https://img.shields.io/badge/blockchain-Base-0052FF)](https://base.org)

---

## 🌟 Features

### 🛍️ E-Commerce
- **Shopify Integration** - Full product catalog and inventory management
- **USDC Payments** - Native Base blockchain payments with automatic verification
- **Smart Cart** - Persistent shopping cart with real-time calculations
- **Shipping** - Real-time rates and address validation
- **Tax Calculation** - Automatic computation based on location

### 🎯 Farcaster Integration
- **Native Mini App** - Seamless Farcaster protocol integration
- **Frame Authentication** - Secure user authentication
- **Dynamic Order Sharing** - Smart cast generation with product images
- **Mini App Embeds** - Rich order confirmation cards
- **Social Sharing** - Built-in viral mechanisms

### 🔔 Smart Notifications
- **Order Confirmations** - Instant payment confirmations
- **Shipping Updates** - Automated tracking notifications
- **Welcome Messages** - New user onboarding with discount codes

### 💰 Advanced Discount System
- **Token-Gated Discounts** - NFT/token holder exclusive offers with automatic verification
- **Shared Discount Codes** - Multi-user codes with per-user usage limits
- **Product-Specific Targeting** - Discounts for specific products or collections
- **Priority-Based Selection** - Automatic best discount determination
- **Usage Tracking** - Comprehensive fraud prevention and analytics

### 🔐 Production-Grade Security
- **Rate Limiting** - Protection against brute force attacks on discount validation
- **Security Headers** - CSP, HSTS, X-Frame-Options, and more
- **JWT Authentication** - Secure admin and partner authentication
- **Role-Based Access Control** - Admin, fulfillment partners, and collab partners
- **Transaction Verification** - On-chain payment verification
- **OWASP Compliance** - 9/10 OWASP API Security Top 10 compliance

---

## 🛠️ Tech Stack

**Frontend**: Next.js 14, TailwindCSS, Wagmi, Viem  
**Backend**: Supabase (PostgreSQL), Shopify Admin API, Neynar API  
**Blockchain**: Base Network, USDC  
**Security**: Rate limiting, JWT auth, CSP headers, RLS policies

---

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── admin/            # Admin dashboard
│   │   ├── partner/          # Partner dashboard
│   │   └── product/          # Product pages
│   ├── components/           # React components
│   └── lib/                  # Core utilities
├── database/                 # Database schema & migrations
└── public/                   # Static assets
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Shopify store with Admin API access
- Supabase account
- Neynar API key (for Farcaster)
- Base network wallet

### Installation

```bash
# Clone repository
git clone https://github.com/SVVVG3/minted-merch-mini-app.git
cd minted-merch-mini-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# Shopify
SHOPIFY_SITE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=your-token
SHOPIFY_WEBHOOK_SECRET=your-secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Neynar (Farcaster)
NEYNAR_API_KEY=your-neynar-key

# Payment
PAYMENT_RECIPIENT_ADDRESS=your-base-wallet
NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS=your-base-wallet

# Security
JWT_SECRET=your-secure-secret
PARTNER_JWT_SECRET=your-partner-secret
ADMIN_PASSWORD=your-admin-password
```

> ⚠️ **Security Note**: Generate strong random secrets for JWT tokens. Never commit secrets to version control.

---

## 🔐 Security

This application implements production-grade security measures:

### Authentication & Authorization
- **JWT tokens** for admin and partner authentication
- **Role-based access control** with three distinct roles:
  - **Admin**: Full system access
  - **Fulfillment Partners**: Order management and shipping
  - **Collab Partners**: View-only order access
- **HTTP-only cookies** for secure token storage
- **Object-level authorization** - users can only access their own data

### API Security
- **Rate limiting** on sensitive endpoints (discount validation, gift cards)
- **Security headers** (CSP, HSTS, X-Frame-Options, etc.)
- **Input validation** and sanitization across all endpoints
- **Webhook signature verification** for Shopify webhooks

### Data Protection
- **Row-level security** (RLS) in Supabase
- **Password hashing** with bcrypt
- **On-chain payment verification** for all transactions
- **No sensitive data** exposed in API responses

**Security Grade: A-** (OWASP API Top 10: 9/10 compliance)

---

## 🎫 Token-Gated Discounts

### How It Works

1. **Create token-gated discount** with NFT/token requirements
2. **User authenticates** via Farcaster
3. **System automatically verifies** blockchain holdings
4. **Discount applies** if eligible

### Discount Types

- **NFT Holding** - Require specific NFT ownership
- **Token Balance** - Minimum token balance requirement
- **Whitelist** - FID or wallet address whitelisting
- **Shared Codes** - Multi-user codes with per-user limits

### API Example

```javascript
// POST /api/validate-discount
{
  "code": "WHALE50",
  "fid": 466111,
  "subtotal": 100.00
}

// Response
{
  "success": true,
  "isValid": true,
  "discountValue": 50,
  "discountAmount": 50.00
}
```

---

## 📊 Order Management

### Admin Dashboard
- View all orders, users, and analytics
- Create and manage discount codes
- Assign orders to partners
- View leaderboard and check-ins

### Partner Dashboard
- **Fulfillment Partners**: View assigned orders, add tracking info, auto-mark as shipped
- **Collab Partners**: View-only access to order details (no shipping info)

---

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy with automatic CI/CD

### Post-Deployment

1. Configure Shopify webhooks with your production URL
2. Test payment flow with small USDC amounts
3. Verify notifications are working
4. Monitor logs for any issues

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Farcaster Team** - Mini App framework
- **Shopify** - E-commerce API
- **Base Team** - L2 infrastructure
- **Supabase** - Real-time database platform

---

## 📞 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Report bugs via GitHub Issues
- **Questions**: Reach out on Farcaster [@svvvg3.eth](https://warpcast.com/svvvg3.eth)

---

**Built with ❤️ for the Farcaster and Base ecosystems**

*Last updated: October 2025*
