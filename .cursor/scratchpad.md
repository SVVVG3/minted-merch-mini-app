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
- [ ] **Task 4**: Create Shopify Storefront API credentials
- [ ] **Task 5**: Validate Shopify API connectivity
- [ ] **Task 6**: Implement collection filtering

### Phase 3 — Farcaster Mini App Context
- [ ] **Task 7**: Enable Farcaster Mini App SDK context
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

- **Task 3**: Local environment setup
  - ✅ .env.local file created with proper placeholder values
  - ✅ Updated with production Vercel URL

### 🔄 Current Status / Progress Tracking

**Currently Working On**: Phase 2 - Shopify Integration (Task 4)

**Current Status**: Phase 1 complete! Ready to begin Shopify API integration

**Deployment Status**: 
- ✅ Local dev: http://localhost:3000
- ✅ Production: https://mintedmerch.vercel.app/
- ⚠️ Shows expected "No products found" (Shopify not configured yet)
- ⚠️ Shopify API errors expected until Task 4-5 completed

### 🚧 Blocked/Waiting
- None currently

## Executor's Feedback or Assistance Requests

**Phase 1 Complete! 🎉**
- ✅ Tasks 1-3 successfully completed
- ✅ Project deployed and accessible at https://mintedmerch.vercel.app/
- ✅ Ready to begin Phase 2: Shopify Integration
- 📋 **Next Action**: Need Shopify store credentials for Task 4

## Lessons

- **Environment Variables**: The starter template requires .env.local file with proper values to prevent 500 errors
- **Shopify API**: Expected to see Shopify fetch errors until API credentials are configured in Tasks 4-5
- **Google Maps**: Optional API key warning is expected and can be ignored for MVP

## Next Steps

1. User should test localhost:3000 to confirm setup
2. Commit Task 1 completion to GitHub  
3. Proceed to Task 2: Setup Vercel project 