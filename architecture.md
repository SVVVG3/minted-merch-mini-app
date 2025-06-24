# Farcaster Mini App Architecture: Shopify Store with Direct Onchain USDC Payments

## Goal

Build a Farcaster Mini App for [https://mintedmerch.shop/](https://mintedmerch.shop/) that allows users to shop directly inside Farcaster and pay using USDC via direct onchain wallet transfers. Use [https://github.com/jc4p/shopify-mini-app-frame](https://github.com/jc4p/shopify-mini-app-frame) as the base template.

---

## Tech Stack

- **Frontend:** Next.js (React), Tailwind CSS
- **Backend/API:** Next.js API routes
- **Shopify:** Storefront API (Headless storefront access)
- **Farcaster:** Neynar SDK + Mini App SDK
- **Payments:** Direct USDC payments to wallet (onchain native)
- **Auth:** Farcaster session context
- **Hosting:** Vercel

---

## High-Level Flow

1. User opens Mini App inside Farcaster
2. Mini App pulls product catalog from Shopify Storefront API
3. User selects products, adds to cart
4. Checkout initialized -> Display payment details for direct USDC transfer
5. Upon USDC payment confirmation (via wallet or future onchain event monitoring), finalize order via Shopify Admin API
6. Notify user of successful purchase inside Mini App

---

## File & Folder Structure

```bash
/shopify-mini-app-frame (root)
├── .env.local             # Environment variables (API keys, secrets)
├── package.json
├── next.config.js         # Next.js config
├── middleware.ts          # Mini App middleware (auth, Farcaster context parsing)
├── /public                # Static assets (logos, images)
├── /components
│   ├── Layout.tsx         # Common layout wrapper
│   ├── ProductCard.tsx    # Display product information
│   ├── Cart.tsx           # Shopping cart component
│   └── PaymentButton.tsx  # USDC payment CTA (displays wallet info)
├── /pages
│   ├── index.tsx          # Home page, product list
│   ├── /api
│   │   ├── /shopify
│   │   │   ├── products.ts  # Fetch products from Shopify
│   │   │   └── checkout.ts  # Initiate Shopify checkout process
│   └── success.tsx       # Order success screen
├── /lib
│   ├── shopify.ts         # Shopify Storefront & Admin API clients
│   └── farcaster.ts       # Neynar & Farcaster Mini App SDK helpers
├── /context
│   ├── CartContext.tsx    # Cart state provider (React Context)
│   └── UserContext.tsx    # Farcaster user session info
├── /types
│   ├── product.ts         # Product type definitions
│   └── order.ts           # Order type definitions
├── /utils
│   └── logger.ts          # Centralized logging util
└── README.md
```

---

## Detailed Explanation

### `/components`

- UI components reused across pages
- Product listing, shopping cart, payment buttons, etc.

### `/pages`

- `index.tsx`: Displays products pulled from Shopify
- `api/shopify/products.ts`: Calls Shopify Storefront API to get product list
- `api/shopify/checkout.ts`: Handles order creation on Shopify after payment
- `success.tsx`: Confirmation page shown after successful purchase

### `/lib`

- `shopify.ts`: Wraps Shopify Storefront API & Admin API calls
- `farcaster.ts`: Wraps Farcaster Mini App SDK + Neynar API (for user context and messaging)

### `/context`

- Global state management via React Context:
  - Cart state
  - Farcaster user info from SDK context

### `/types`

- Typed interfaces for Shopify product data, order structures

### `/utils/logger.ts`

- Centralized logger for debugging & monitoring

---

## State Management

- **Frontend State:** React Context API (`CartContext`, `UserContext`)
- **Session Context:** Farcaster Mini App SDK provides user info on page load (FID, username, etc)
- **Payment State:** Payment is handled directly onchain by sending USDC to your configured recipient wallet address
- **Order State:** Shopify order records updated after payment (can be done manually or via optional automation if onchain monitoring is implemented)

---

## Services & Integrations

| Service                | Purpose         | Notes                                   |
| ---------------------- | --------------- | --------------------------------------- |
| Shopify Storefront API | Product catalog | Used for browsing products              |
| Shopify Admin API      | Order creation  | Used after payment is confirmed         |
| Farcaster Mini App SDK | Auth + Context  | Get user session info (FID, username)   |
| Neynar                 | Farcaster API   | Optional: post casts / DM confirmations |
| Onchain wallet address | USDC payments   | Direct wallet transfer                  |

---

## Deployment

- Deploy to Vercel for seamless Farcaster Mini App hosting
- Use `.env.local` for API keys:

```env
# Shopify Configuration
SHOPIFY_SITE_DOMAIN=your-store-name.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
TARGET_COLLECTION_HANDLE=all

# Payment Configuration
PAYMENT_RECIPIENT_ADDRESS=0xYourWalletAddress
NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS=0xYourWalletAddress

# Optional: Google Maps API for address autocomplete
GOOGLE_MAPS_API_KEY=your-api-key
```

---

## Bonus Features (Future Iterations)

- Order history view inside Mini App
- Cast order confirmations via Farcaster
- Referral links or affiliate tracking
- NFT-gated merch drops
- Airdrop rewards for purchases
- Onchain payment event monitoring to automate Shopify order creation

---

## Rough User Flow:

1. User opens Mini App (auth handled by Mini App context)
2. Browse products -> Add to cart -> Checkout
3. Display USDC payment instructions with recipient wallet address
4. User sends payment via wallet (manual confirmation or future onchain monitoring)
5. Upon confirmation, Shopify Admin API used to create order
6. Show success screen -> Optionally cast order confirmation

