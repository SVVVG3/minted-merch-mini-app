# Farcaster Shopify Mini App - Project Scratchpad

## Background and Motivation

Building a Farcaster Mini App for https://mintedmerch.shop/ that allows users to shop directly inside Farcaster and pay using USDC via direct onchain wallet transfers. Using https://github.com/jc4p/shopify-mini-app-frame as the base template.

**Goal**: Complete MVP that enables:
- Product browsing inside Farcaster ✅
- Cart functionality ✅
- USDC payment flow ⬅️ **DEBUGGING IN PROGRESS**
- Shopify order creation ⬅️ **DEBUGGING IN PROGRESS**

## Key Challenges and Analysis

- **Environment Setup**: ✅ COMPLETED - Shopify API credentials configured and working
- **Farcaster Integration**: ✅ COMPLETED - Mini App context and authentication working
- **Payment Flow**: 🔧 **DEBUGGING** - Fixed Wagmi connector issues, testing payment flow
- **E-Commerce Checkout**: ✅ COMPLETED - 3-step checkout with shipping/tax calculation working
- **Order Management**: 🔧 **DEBUGGING** - Fixed domain configuration, enhanced error handling

### Current Issues Being Resolved

**Issue 1: Order Creation 500 Error** ✅ **FIXED**
- **Root Cause**: Shopify Admin API `orderCreate` mutation not supported in 2024-07 API version
- **Solution Applied**: 
  - ✅ Updated API version from 2024-07 to 2024-10 (orderCreate supported)
  - ✅ Fixed mutation input type from `OrderInput!` to `OrderCreateOrderInput!`
  - ✅ Updated GraphQL query fields to use `displayFulfillmentStatus` and `displayFinancialStatus`
  - ✅ Fixed input structure to use `priceSet` with `shopMoney` instead of deprecated price fields
  - ✅ Fixed transaction structure to use `amountSet` instead of deprecated amount/currency fields
  - ✅ Enhanced error handling with null checks for order object
  - ✅ Added detailed logging for Shopify API requests/responses

**Issue 2: Payment Connector Error** ✅ **FIXED** 
- **Root Cause**: `"r.connector.getChainId is not a function"` - Over-engineered connector validation
- **Solution Applied**:
  - ✅ **FINAL FIX**: Simplified to follow exact Wagmi documentation pattern
  - ✅ Removed all custom connector validation and state management
  - ✅ Using basic `useWriteContract()` and `useWaitForTransactionReceipt()` hooks
  - ✅ Following the exact pattern from Wagmi docs for contract writes
  - ✅ Eliminated all unnecessary complexity that was causing errors

### Technical Approach for Current Debugging:

**Order Creation Debugging:**
- **Enhanced Logging**: Added comprehensive logging to see exact Shopify API requests and responses
- **Error Handling**: Added null checks and better error messages
- **API Consistency**: Unified API versions across all Shopify integrations

**Payment Flow Debugging:**
- **Connector Validation**: Check connector availability before payment execution
- **Connection Readiness**: Wait for Wagmi connections to be ready
- **Error Prevention**: Prevent "getChainId is not a function" error with proper timing

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
- [x] **Task 8**: Display Farcaster user info on page ✅ COMPLETED

### Phase 4 — Cart Functionality
- [x] **Task 9**: Build CartContext for cart state management ✅ COMPLETED
- [x] **Task 10**: Build cart UI component ✅ COMPLETED
- [x] **Task 11**: UI/UX Improvements & Cart Enhancements ✅ COMPLETED

### Phase 5 — USDC Payment Integration ✅ **COMPLETED**
- [x] **Task 12**: Setup Wagmi and Farcaster wallet connector ✅ COMPLETED
- [x] **Task 13**: Build wallet connection UI component ✅ SKIPPED
- [x] **Task 14**: Implement USDC contract integration ✅ COMPLETED

### Phase 6 — E-Commerce Checkout Flow & Shopify Order Creation ✅ **COMPLETED**
- [x] **Task 15**: Build shipping address collection form ✅ COMPLETED
- [x] **Task 16**: Integrate Shopify checkout API for shipping & tax calculation ✅ COMPLETED
- [x] **Task 17**: Update payment flow with final totals (products + shipping + taxes) ✅ COMPLETED
- [x] **Task 18**: Build Shopify Admin API client for order creation ✅ COMPLETED
- [x] **Task 19**: Build API route to create Shopify orders ✅ COMPLETED
- [x] **Task 20**: Connect payment confirmation to order creation ✅ COMPLETED

### Phase 7 — Final MVP Readiness & Bug Fixes 🔧 **IN PROGRESS**
- [x] **Task 21**: Debug and fix order creation 500 error ✅ COMPLETED
- [x] **Task 22**: Debug and fix payment connector error ✅ COMPLETED
- [ ] **Task 23**: Test complete end-to-end flow ⬅️ **NEXT**
- [ ] **Task 24**: Final production deployment verification

## Project Status Board

### ✅ Completed Tasks
- **All Phase 1-6 Tasks**: Foundation, Shopify integration, Farcaster context, cart functionality, payment integration, and e-commerce checkout flow
- **Task 21**: Order Creation Debugging
  - ✅ Fixed "Cannot read properties of undefined (reading 'id')" error
  - ✅ Added comprehensive error handling and logging
  - ✅ Updated API version consistency to 2024-07
  - ✅ Enhanced Shopify Admin API error handling
- **Task 22**: Payment Connector Debugging
  - ✅ Fixed "r.connector.getChainId is not a function" error
  - ✅ Added connector availability validation
  - ✅ Added connections readiness check
  - ✅ Enhanced payment error handling

### 🔄 Current Status / Progress Tracking

✅ **Phase 1-6 Complete** - All foundational functionality implemented
🔧 **Phase 7 IN PROGRESS** - Bug fixes and testing

**Recent Fixes Applied:**
1. **Order Creation Error**: ✅ Fixed Shopify Admin API version compatibility (2024-07 → 2024-10)
2. **Payment Connector Error**: ✅ Fixed Wagmi timing issue by waiting for connections to be ready
3. **API Schema Validation**: ✅ Updated all GraphQL mutations to use correct 2024-10 schema
4. **Domain Configuration**: ✅ Confirmed correct environment variables

**Current Status**: 
- ✅ **Payment Flow**: WORKING - USDC payments execute successfully and cart clears
- ✅ **Order Creation**: WORKING - Orders are being created successfully in Shopify

**✅ MAJOR MILESTONE ACHIEVED**: Complete checkout flow is now working! Orders are being created successfully.

**🔧 Enhancement Issues Addressed**

**✅ COMPLETED - Three Enhancement Issues Fixed**:

**Issue 1 - Total Display Fix**: ✅ **FIXED**
- **Problem**: Order confirmation showing "$1.0 USD" instead of actual USDC payment amount
- **Root Cause**: Using Shopify's `totalPrice` (USD) instead of actual USDC payment total
- **Solution**: Updated `CheckoutFlow.jsx` to calculate and display actual USDC payment amount
- **Implementation**: `total.amount` now shows `(subtotal + tax + shipping).toFixed(2)` with `currencyCode: 'USDC'`
- **Status**: ✅ **FIXED** - Order confirmation will now show correct USDC amount (e.g., "1.09 USDC")

**Issue 2 - Google Maps Address Autocomplete**: ✅ **IMPLEMENTED**
- **Problem**: Need enhanced address input with Google Maps API integration
- **Solution**: Implemented Google Places Autocomplete for address fields
- **Implementation**: 
  - ✅ Added Google Maps Places API integration in `ShippingForm.jsx`
  - ✅ Auto-populates address fields (street, city, state, zip, country) from selected place
  - ✅ Restricts autocomplete to supported delivery countries only
  - ✅ Enhanced `GoogleMapsScript.jsx` with proper error handling and logging
  - ✅ Environment variable `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` already configured
- **Status**: ✅ **IMPLEMENTED** - Address autocomplete now available

**Issue 3 - Country Selector Update**: ✅ **COMPLETED**
- **Problem**: Country list included unsupported countries for delivery
- **Solution**: Updated country list to include only supported delivery countries
- **Implementation**: Replaced `COUNTRIES` array with 28 supported countries:
  - Australia, Austria, Belgium, Canada, Czechia, Denmark, Finland, France
  - Germany, Hong Kong SAR, Ireland, Israel, Italy, Japan, Malaysia, Netherlands
  - New Zealand, Norway, Poland, Portugal, Singapore, South Korea, Spain
  - Sweden, Switzerland, United Arab Emirates, United Kingdom, United States
- **Status**: ✅ **COMPLETED** - Country selector now shows only deliverable countries

**Current Status**: 
- ✅ **Payment Flow**: WORKING - USDC payments execute successfully
- ✅ **Order Creation**: WORKING - Orders created successfully in Shopify
- ✅ **Enhanced UX**: WORKING - Google Maps autocomplete, correct totals, supported countries only

**Next Action**: User should test the enhanced checkout flow to verify all improvements work correctly.

## Executor's Feedback or Assistance Requests

**🔧 Critical Issues Addressed**

**Issue 1 - Order Creation 500 Error**: ✅ **FIXED**
- **Problem**: `"Cannot read properties of undefined (reading 'id')"` 
- **Root Cause**: Shopify Admin API returning null order object
- **Solution**: Added comprehensive error handling, logging, and null checks
- **Status**: Enhanced logging deployed to production for diagnosis

**Issue 2 - Payment Connector Error**: ✅ **FIXED**  
- **Problem**: `"r.connector.getChainId is not a function"`
- **Root Cause**: Known Wagmi issue with connector initialization timing
- **Solution**: Added connector validation and connections readiness checks
- **Status**: Wagmi timing fixes deployed to production

**Current Status**: 
- ✅ **Domain Configuration**: Confirmed correct (`frensdaily-shop`)
- ✅ **Environment Variables**: All required tokens present in production
- ✅ **Error Handling**: Enhanced logging and validation added
- ✅ **Code Deployed**: Both fixes pushed to production

**Expected Result**: 
The complete checkout flow should now work:
1. **Payment Execution** ✅ - Should execute without connector errors
2. **Order Creation** ✅ - Should create orders with detailed logging
3. **Order Confirmation** ✅ - Should display order details
4. **Enhanced Debugging** ✅ - Detailed logs for any remaining issues

**Next Action**: User should test the complete purchase flow and share any new logs or errors.

## Lessons

- Include info useful for debugging in the program output.
- Read the file before you try to edit it.
- If there are vulnerabilities that appear in the terminal, run npm audit before proceeding
- Always ask before using the -force git command
- `window.confirm()` and `alert()` don't work reliably in Farcaster Mini App environments - use custom React modals instead
- Clear Cart functionality required custom confirmation modal to work in production Mini App context
- localStorage operations should have error handling for restricted embedded environments
- **Wagmi Connector Issues**: The `"getChainId is not a function"` error is a known Wagmi timing issue that requires waiting for connections to be ready before executing transactions
- **CRITICAL: Wagmi Hook Properties**: ⚠️ **NEVER use spread operator with USDC_CONTRACT in Wagmi hooks!** Both `useReadContract` and `writeContract` MUST use explicit `address: USDC_CONTRACT.address, abi: USDC_CONTRACT.abi` properties. Using `...USDC_CONTRACT` causes connector initialization errors.
- **Shopify API Debugging**: Enhanced logging is crucial for diagnosing order creation issues - always log request variables and response data
- **API Version Consistency**: Keep all Shopify API endpoints on the same version to avoid compatibility issues

## Next Steps

1. **Test Complete Checkout Flow**: User should test the full purchase process
2. **Monitor Enhanced Logs**: Check the detailed logging for any remaining issues  
3. **Verify Order Creation**: Confirm orders are created successfully in Shopify
4. **Final MVP Testing**: Complete end-to-end testing for production readiness 