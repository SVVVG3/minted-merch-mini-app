# MVP Build Plan: Farcaster Shopify Mini App

### Phase 1 — Setup & Bootstrapping

**Task 1: Clone starter repo & initialize project**
- Clone `https://github.com/jc4p/shopify-mini-app-frame`
- Install dependencies: `npm install`
- Verify repo builds and runs locally: `npm run dev`

**Task 2: Setup Vercel project**
- Connect repo to Vercel
- Setup environment variables in Vercel dashboard

**Task 3: Create `.env.local` file for local development**
- Add placeholder keys for:
  - `SHOPIFY_SITE_DOMAIN`
  - `SHOPIFY_ACCESS_TOKEN`
  - `PAYMENT_RECIPIENT_ADDRESS`
  - `NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS`

---

### Phase 2 — Shopify Integration

**Task 4: Create Shopify Storefront API credentials**
- In Shopify admin, create a private app or custom app
- Generate Storefront API Access Token
- Add credentials to `.env.local` and Vercel

**Task 5: Validate Shopify API connectivity**
- Open `api/shopify/products.ts`
- Test fetching product list from Shopify Storefront API
- Confirm product list renders in `/pages/index.tsx`

**Task 6: Implement collection filtering**
- Set `TARGET_COLLECTION_HANDLE` in `.env.local` to limit products
- Validate only products from target collection display

---

### Phase 3 — Farcaster Mini App Context

**Task 7: Enable Farcaster Mini App SDK context**
- Ensure `middleware.ts` correctly parses Mini App context
- Validate user FID, username, and session context load properly

**Task 8: Display Farcaster user info on page**
- In `Layout.tsx`, render current FID and username (from context)
- Confirm context works when loaded inside Farcaster

---

### Phase 4 — Cart Functionality

**Task 9: Build CartContext for cart state management**
- Create `CartContext.tsx` for global state
- Implement add-to-cart functionality in `ProductCard.tsx`

**Task 10: Build cart UI component**
- Build `/components/Cart.tsx` to display current cart contents
- Verify items persist in cart while navigating pages

---

### Phase 5 — Payment Flow

**Task 11: Render USDC payment instructions**
- In `PaymentButton.tsx`, display recipient wallet address
- Dynamically calculate USDC total based on cart contents

**Task 12: Build confirmation screen (success page)**
- Create `/pages/success.tsx` to display after payment
- Include simple link/button for user to cast their purchase

---

### Phase 6 — Shopify Order Creation

**Task 13: Build Shopify Admin API client**
- Create `lib/shopify.ts` Admin API client
- Authenticate using Admin API credentials

**Task 14: Build API route to create Shopify orders**
- Create `/api/shopify/checkout.ts`
- On request, create draft order in Shopify with cart contents

**Task 15: Manually trigger order creation after payment (for MVP)**
- Add simple developer-only button to trigger order creation manually for now
- This simulates "payment confirmed" without onchain monitoring

---

### Phase 7 — Final MVP Readiness

**Task 16: Test full end-to-end MVP flow**
- Open Mini App inside Farcaster
- Add items to cart
- Display USDC payment instructions
- Manually mark payment complete & trigger Shopify order
- Confirm order is created in Shopify

**Task 17: Prepare production deployment**
- Clean up code
- Lock Vercel environment variables with production credentials
- Launch to production URL

---

👉 At this point, you have a fully working MVP: users shop inside Farcaster, pay in USDC, and orders are manually finalized after confirming payment.

