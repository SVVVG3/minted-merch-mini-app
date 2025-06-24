# Farcaster Shopify Mini App - Project Scratchpad

## Background and Motivation

Building a Farcaster Mini App for https://mintedmerch.shop/ that allows users to shop directly inside Farcaster and pay using USDC via direct onchain wallet transfers. Using https://github.com/jc4p/shopify-mini-app-frame as the base template.

**Goal**: Complete MVP that enables:
- Product browsing inside Farcaster
- Cart functionality
- USDC payment flow
- Shopify order creation

## Key Challenges and Analysis

- **Environment Setup**: Need to configure Shopify API credentials and payment wallet addresses
- **Farcaster Integration**: Ensure proper Mini App context and authentication
- **Payment Flow**: Direct USDC payments without complex onchain monitoring for MVP
- **Order Management**: Manual order creation in Shopify after payment confirmation

## High-level Task Breakdown

### Phase 1 — Setup & Bootstrapping
- [x] **Task 1**: Clone starter repo & initialize project ✅ COMPLETED
- [x] **Task 2**: Setup Vercel project ✅ COMPLETED
- [x] **Task 3**: Create `.env.local` file for local development ✅ COMPLETED

### Phase 2 — Shopify Integration
- [x] **Task 4**: Create Shopify Storefront API credentials ✅ COMPLETED
- [x] **Task 5**: Validate Shopify API connectivity ✅ COMPLETED
- [ ] **Task 6**: Implement collection filtering

### Phase 3 — Farcaster Mini App Context
- [x] **Task 7**: Enable Farcaster Mini App SDK context ✅ COMPLETED
- [ ] **Task 8**: Display Farcaster user info on page

### Phase 4 — Cart Functionality
- [ ] **Task 9**: Build CartContext for cart state management
- [ ] **Task 10**: Build cart UI component

### Phase 5 — Payment Flow
- [ ] **Task 11**: Render USDC payment instructions
- [ ] **Task 12**: Build confirmation screen (success page)

### Phase 6 — Shopify Order Creation
- [ ] **Task 13**: Build Shopify Admin API client
- [ ] **Task 14**: Build API route to create Shopify orders
- [ ] **Task 15**: Manually trigger order creation after payment (for MVP)

### Phase 7 — Final MVP Readiness
- [ ] **Task 16**: Test full end-to-end MVP flow
- [ ] **Task 17**: Prepare production deployment

## Project Status Board

### ✅ Completed Tasks
- **Task 1**: Project initialization
  - ✅ Cloned starter repo from GitHub
  - ✅ Installed dependencies (125 packages)
  - ✅ Created .env.local with placeholder values
  - ✅ Verified dev server runs on http://localhost:3000
  - ✅ Confirmed Farcaster frame metadata properly configured

- **Task 2**: Vercel project setup
  - ✅ Pushed code to GitHub: https://github.com/SVVVG3/minted-merch-mini-app
  - ✅ Connected repo to Vercel
  - ✅ Configured environment variables in Vercel
  - ✅ Successfully deployed to: https://mintedmerch.vercel.app/
  - ✅ Updated local .env.local with production URL

- **Task 4**: Shopify Storefront API credentials
  - ✅ Created custom app in Shopify admin
  - ✅ Configured Storefront API permissions (product_listings, checkouts)
  - ✅ Generated access token: 3e03fbb876dd1f8b4903cd4f0dfa740d
  - ✅ Domain: shopfrensdaily.myshopify.com
  - ✅ Updated environment variables

- **Task 5**: Shopify API connectivity validation
  - ✅ Fixed API endpoint (Storefront vs Admin API)
  - ✅ Fixed authentication headers (X-Shopify-Storefront-Access-Token)
  - ✅ Updated GraphQL queries for Storefront API compatibility
  - ✅ Collection 'allproducts' successfully loaded
  - ✅ 13+ products displaying with images, titles, and prices
  - ✅ Products: OK Custom T-Shirt, Bankr Cap, Bankr Hoodie, and more
  - ✅ **CRITICAL FIXES**: Fixed price display issues
    - Fixed ProductCard price calculation (removed incorrect *0.01)
    - Fixed individual product page prices ($NaN → correct prices)
    - Fixed variant option prices in VariantSelector ($NaN → correct prices)
    - All pricing now displays correctly across the entire app

- **Task 3**: Local environment setup
  - ✅ .env.local file created with proper placeholder values
  - ✅ Updated with production Vercel URL

- **Task 7**: Farcaster Mini App SDK context + Manifest
  - ✅ Installed @farcaster/frame-sdk package
  - ✅ Updated frame initialization with proper error handling and logging
  - ✅ Created FarcasterHeader component to display user info when in Farcaster context
  - ✅ Created useFarcaster React hook for easy context access
  - ✅ Added preconnect hint to https://auth.farcaster.xyz for performance
  - ✅ Enhanced SDK initialization with proper context detection
  - ✅ App properly handles both Farcaster and non-Farcaster environments
  - ✅ **ADDED**: Created farcaster.json manifest file for Mini App registration
  - ✅ **ADDED**: Built webhook endpoint at /api/webhook for Farcaster events
  - ✅ **ADDED**: Updated page metadata with proper Open Graph tags
  - ✅ **ADDED**: Integrated custom MintedMerch branding images (logo, splash, OG)
  - ✅ Code deployed to production at https://mintedmerch.vercel.app/

### 🔄 Current Status / Progress Tracking

**Currently Working On**: Phase 3 - Farcaster Mini App Context (Task 8)

**Current Status**: Task 7 COMPLETE! 🎉 Farcaster Mini App SDK integrated and working

**Deployment Status**: 
- ✅ Local dev: http://localhost:3000
- ✅ Production: https://mintedmerch.vercel.app/
- ✅ Shopify API connected and working perfectly
- ✅ 13+ products displaying with correct images and prices
- ✅ Individual product pages working with proper variant pricing
- ✅ All price display issues resolved
- ✅ Farcaster Mini App SDK integrated and deployed
- 🎯 Ready for Task 8: Display Farcaster user info on page

### 🚧 Blocked/Waiting
- None currently

## Executor's Feedback or Assistance Requests

**Task 7 Complete! 🎉 FARCASTER MINI APP READY FOR REGISTRATION**
- ✅ Tasks 1-7 successfully completed including critical pricing fixes
- ✅ Project deployed and accessible at https://mintedmerch.vercel.app/
- ✅ Shopify API fully integrated and working perfectly
- ✅ Farcaster Mini App SDK integrated with proper context detection
- ✅ App properly handles both Farcaster and non-Farcaster environments
- ✅ FarcasterHeader component ready to display user info when in Farcaster context
- ✅ useFarcaster hook available for easy context access throughout app
- ✅ **NEW**: Farcaster manifest (farcaster.json) created and deployed
- ✅ **NEW**: Webhook endpoint ready for Farcaster events at /api/webhook
- ✅ **NEW**: Custom MintedMerch branding integrated (logo, splash, OG images)
- ✅ **NEW**: Proper Open Graph metadata for social sharing
- 🎯 **READY FOR**: Farcaster Mini App registration with manifest at https://mintedmerch.vercel.app/farcaster.json

## Lessons

- **Environment Variables**: The starter template requires .env.local file with proper values to prevent 500 errors
- **Shopify API**: Expected to see Shopify fetch errors until API credentials are configured in Tasks 4-5
- **Google Maps**: Optional API key warning is expected and can be ignored for MVP

## Next Steps

1. User should test localhost:3000 to confirm setup
2. Commit Task 1 completion to GitHub  
3. Proceed to Task 2: Setup Vercel project 