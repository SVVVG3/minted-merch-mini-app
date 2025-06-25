# Farcaster Shopify Mini App - Project Scratchpad

## Background and Motivation

Building a Farcaster Mini App for https://mintedmerch.shop/ that allows users to shop directly inside Farcaster and pay using USDC via direct onchain wallet transfers. Using https://github.com/jc4p/shopify-mini-app-frame as the base template.

**Goal**: Complete MVP that enables:
- Product browsing inside Farcaster ✅
- Cart functionality ✅
- USDC payment flow ✅ **WORKING**
- Shopify order creation ✅ **WORKING**
- Enhanced UX features ✅ **COMPLETED**
- Viral sharing functionality ✅ **WORKING**

## Key Challenges and Analysis

- **Environment Setup**: ✅ COMPLETED - Shopify API credentials configured and working
- **Farcaster Integration**: ✅ COMPLETED - Mini App context and authentication working
- **Payment Flow**: ✅ COMPLETED - USDC payments execute successfully and cart clears
- **E-Commerce Checkout**: ✅ COMPLETED - 3-step checkout with shipping/tax calculation working
- **Order Management**: ✅ COMPLETED - Orders are being created successfully in Shopify
- **Google Maps Migration**: ✅ **COMPLETED** - Migrated to new PlaceAutocompleteElement API
- **UX Improvements**: ✅ **COMPLETED** - Fixed Google Maps clearing user data and "(Default Title)" display issues
- **Viral Sharing System**: ✅ **WORKING** - Both product and order sharing with proper Mini App embeds and improved messaging

### RESOLVED: Complete Viral Sharing System ✅ **WORKING**

**Latest Updates**: Fixed remaining issues with order success sharing to complete the viral sharing system.

**Order Success Sharing Fixes**:
1. **✅ Mini App Embed**: Now uses main app URL (`window.location.origin`) instead of dynamic OG image, which generates Mini App embed using the `fc:frame` meta tag from the main page
2. **✅ Updated Share Text**: New format with specific product names and improved messaging:
   - Single product: "🎉 Just bought a Bankr Cap with USDC!"
   - Multiple products: "🎉 Just bought a Bankr Cap and OK Custom T-Shirt with USDC!"
   - Includes order number: "Order #1181 for 1.09 confirmed ✅"
   - Proper call-to-action: "Shop on /mintedmerch - pay on Base 🔵"

**Product Page Sharing Updates**:
1. **✅ Dynamic Button Text**: Mini App embed buttons now show "Buy {Product Name} 📦" instead of generic text
2. **✅ Improved Share Text**: Updated to "Check out this {Product Name} on /mintedmerch! Order now & pay with USDC on Base 🔵"

**Technical Implementation**:
- **Main App Embed**: Uses existing `fc:frame` meta tag on main page with "Shop Now 📦" button
- **Product Names Logic**: Intelligently formats single/multiple products with proper grammar
- **Quantity Handling**: Shows quantities when > 1 (e.g., "Bankr Cap (2x)")
- **Variant Support**: Includes variant names when not "Default Title"
- **Cross-Platform**: Works in both Farcaster and web environments with appropriate fallbacks

**Viral Loop Complete**:
1. **Discovery**: User sees shared product/order in Farcaster feed with Mini App embed
2. **Engagement**: Rich embed with branded image and specific call-to-action
3. **Conversion**: One-click to open Mini App and browse/purchase
4. **Amplification**: User shares their purchase with specific product names, continuing the loop

### Recent Major Feature: Viral Sharing System ✅ **WORKING**

**Implementation Overview**: Created a comprehensive viral sharing system that allows users to share products and order confirmations directly in Farcaster feeds with rich embeds.

**Feature 1: Product Page Sharing** ✅ **WORKING**
- **Share Button**: Added share button to product page header next to cart button
- **Dynamic Meta Tags**: Implemented server-side metadata generation for each product page
- **Farcaster Frame Embeds**: Each product URL generates `fc:frame` meta tags with:
  - Static branded image via `/og-image.png`
  - Product-specific call-to-action button: "🛒 Shop Crypto Merch"
  - Direct deep-link to product page in Mini App
  - Proper splash screen configuration
- **Smart Sharing Logic**: 
  - ✅ **Farcaster Environment**: Opens Warpcast composer with pre-filled share text and URL
  - ✅ **Non-Farcaster Fallback**: Uses native Web Share API or clipboard copy
  - ✅ **Share Text**: "🛒 Check out this {product} for ${price} USDC! Shop crypto merch with instant payments on Base 🔵"

**Feature 2: Order Success Sharing** ✅ **WORKING**
- **Share Purchase Button**: Added prominent "Share My Purchase" button on order confirmation
- **Order Celebration**: Encourages users to share their successful crypto purchases
- **Dynamic OG Images**: Order-specific images via `/api/og/order?order={number}&total={amount}`
- **Viral Share Text**: "🎉 Just bought crypto merch with USDC! Order {number} for ${total} confirmed ✅ Instant payments on Base 🔵"

**Feature 3: Static Open Graph Images** ✅ **WORKING**
- **Static Branded Image**: Using `/og-image.png` for consistent branding across all shares
- **Reliable Performance**: No dynamic generation complexity, instant loading
- **Professional Design**: Clean branded design that works for all products
- **CDN Optimized**: Static assets served efficiently from Vercel CDN

**Technical Architecture**:
- **Server-Side Metadata**: Product pages use `generateMetadata()` for dynamic `fc:frame` tags
- **Static Assets**: OG images use static files for reliability and performance
- **Component Separation**: Split product page into server/client components for metadata support
- **Cross-Platform Sharing**: Intelligent detection of Farcaster vs. web environment
- **Error Resilience**: Simple implementation without complex error handling

**Viral Loop Implementation**:
1. **Discovery**: User sees shared product/order in Farcaster feed
2. **Engagement**: Rich embed with branded image and clear CTA
3. **Conversion**: One-click to open Mini App and purchase
4. **Amplification**: User shares their own purchase, continuing the loop

### Recent UX Fixes

**Issue 1: Google Maps Clearing First/Last Name** ✅ **FIXED**
- **Root Cause**: When Google Maps autocomplete selected a place, the `populateAddressFromPlace` function was creating a completely new shipping object, overwriting firstName and lastName fields
- **Solution Applied**: 
  - ✅ **Preserve User Data**: Modified `populateAddressFromPlace` to preserve existing firstName, lastName, phone, and email when updating address
  - ✅ **Smart Address Update**: Only update address-related fields (address1, city, province, zip, country) from Google Maps
  - ✅ **Clear Address2**: Reset address2 field when using autocomplete for cleaner addresses
  - ✅ **React Closure Fix**: Used functional update pattern `setShipping(currentShipping => ...)` to prevent stale state closure issues
- **Status**: ✅ **COMPLETED** - Users can now fill in their name first, then use address autocomplete without losing their personal information

**Issue 2: "(Default Title)" Display in Product Names** ✅ **FIXED**
- **Root Cause**: Cart items store both product title and variant title, and when variant title was "Default Title", it was being displayed as "Product Name (Default Title)"
- **Solution Applied**: 
  - ✅ **Order History**: Updated OrderHistory component to only show variant title if it's not "Default Title"
  - ✅ **Checkout Flow**: Updated all three instances in CheckoutFlow component (shipping, shipping-method, and payment steps) to hide "Default Title" variants
  - ✅ **Consistent Logic**: Applied consistent filtering logic: `item.variant?.title && item.variant.title !== 'Default Title' && \`(${item.variant.title})\``
- **Status**: ✅ **COMPLETED** - Product names now display cleanly without unnecessary "(Default Title)" text

### Recent API Migration

**Issue: Google Places API Deprecation Warning** ✅ **FIXED**
- **Root Cause**: Google deprecated `google.maps.places.Autocomplete` as of March 1st, 2025
- **Warning Message**: "As of March 1st, 2025, google.maps.places.Autocomplete is not available to new customers. Please use google.maps.places.PlaceAutocompleteElement instead."
- **Solution Applied**: 
  - ✅ **Complete Migration**: Updated from deprecated `Autocomplete` to new `PlaceAutocompleteElement`
  - ✅ **API Import**: Changed to use `await google.maps.importLibrary('places')` for dynamic loading
  - ✅ **Event Handling**: Updated from `place_changed` event to `gmp-select` event listener
  - ✅ **Place Object**: Updated to use `event.placePrediction.toPlace()` and `place.fetchFields()`
  - ✅ **Address Components**: Updated field names from `long_name/short_name` to `longText/shortText`
  - ✅ **Country Restrictions**: Changed from `setComponentRestrictions()` to `includedRegionCodes` property
  - ✅ **UI Integration**: Replaced input element binding with container-based embedding
  - ✅ **CSS Styling**: Added CSS custom properties for styling the new element
  - ✅ **Fallback Support**: Maintained fallback input when Google Maps API is not available
- **Status**: ✅ **COMPLETED** - No more deprecation warnings, future-proofed implementation

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

### Phase 7 — Final MVP Readiness & Enhancements ✅ **COMPLETED**
- [x] **Task 21**: Debug and fix order creation 500 error ✅ COMPLETED
- [x] **Task 22**: Debug and fix payment connector error ✅ COMPLETED
- [x] **Task 23**: Test complete end-to-end flow ✅ COMPLETED
- [x] **Task 24**: Enhanced UX features (totals, address autocomplete, country filtering) ✅ COMPLETED
- [x] **Task 25**: Google Maps API migration to eliminate deprecation warnings ✅ COMPLETED

### Phase 8 — Viral Sharing System ✅ **COMPLETED**
- [x] **Task 26**: Implement product page sharing with Farcaster embeds ✅ COMPLETED
- [x] **Task 27**: Add order success sharing functionality ✅ COMPLETED
- [x] **Task 28**: Create static Open Graph image approach ✅ COMPLETED
- [x] **Task 29**: Implement cross-platform sharing logic ✅ COMPLETED
- [x] **Task 30**: Fix Mini App embed generation following official docs ✅ COMPLETED

## Project Status Board

### 🎯 **MVP Status: 100% COMPLETE** - All core functionality working including viral sharing

**Core Features Working**:
- ✅ **Product Browsing**: Users can browse products inside Farcaster
- ✅ **Cart Management**: Add/remove items, view cart totals
- ✅ **USDC Payments**: Seamless onchain payments with proper Wagmi integration
- ✅ **Order Creation**: Orders successfully created in Shopify
- ✅ **Enhanced UX**: Google Maps autocomplete, correct totals, supported countries
- ✅ **Future-Proof**: Migrated to latest Google Maps APIs
- ✅ **Viral Sharing**: Product and order sharing with Mini App embeds working

**Technical Stack**:
- ✅ **Frontend**: Next.js 14 with React components
- ✅ **Payments**: USDC on Base network via Wagmi
- ✅ **E-commerce**: Shopify Storefront + Admin APIs
- ✅ **Address Input**: Google Places API (New) with PlaceAutocompleteElement
- ✅ **Sharing**: Farcaster frame embeds with static OG images
- ✅ **Deployment**: Vercel with proper environment configuration

**Current Status**: 
- ✅ **Payment Flow**: WORKING - USDC payments execute successfully
- ✅ **Order Creation**: WORKING - Orders created successfully in Shopify
- ✅ **Enhanced UX**: WORKING - All enhancements implemented and tested
- ✅ **API Compliance**: WORKING - No deprecation warnings, future-proofed
- ✅ **Viral Sharing**: WORKING - Both product and order sharing generating proper Mini App embeds

## Executor's Feedback or Assistance Requests

**🎉 SUCCESS: Viral Sharing System Complete**

**Resolution**: Following the official Farcaster documentation exactly resolved all Mini App embed issues.

**What Worked**:
- **Simple Implementation**: Removed complex async operations and error handling
- **Static Images**: Used static `/og-image.png` instead of dynamic generation
- **Official Patterns**: Followed exact `fc:frame` meta tag format from Farcaster docs
- **Proper JSON Structure**: Used exact frame embed structure as specified

**Technical Verification**:
- ✅ **HTML Output**: `fc:frame` meta tag appears correctly in server response
- ✅ **Product Metadata**: Dynamic titles like "Bankr Cap - Minted Merch Shop" 
- ✅ **Share Functionality**: Both product and order sharing working
- ✅ **Cross-Platform**: Works in Farcaster and web environments

**Ready for Production**: The viral sharing system is now complete and ready for users to share products and orders in Farcaster feeds with rich Mini App embeds.

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
- **Google Maps API Migration**: Google is actively deprecating older APIs. The `google.maps.places.Autocomplete` was deprecated March 1st, 2025. Always migrate to newer APIs (`PlaceAutocompleteElement`) to avoid console warnings and ensure continued functionality. The new API uses different event names (`gmp-select` vs `place_changed`), data structures (`longText/shortText` vs `long_name/short_name`), and integration methods (container-based vs input-based).
- **Google Maps Form Preservation**: When implementing address autocomplete, always preserve existing user input (firstName, lastName, phone, email) by using spread operator with existing state rather than creating a completely new object. Only update address-related fields from the autocomplete result.
- **Variant Title Display**: When displaying product information, check if variant title is "Default Title" before showing it to users. This prevents confusing display text like "Product Name (Default Title)" and keeps the UI clean and professional.
- **React State Closures**: When using state in event listeners (like Google Maps callbacks), use functional updates `setState(current => ...)` instead of direct state access to prevent stale closure issues.
- **Farcaster Sharing Implementation**: For viral sharing in Farcaster Mini Apps, implement both Farcaster-specific sharing (Warpcast composer) and web fallbacks (Web Share API, clipboard). Use `fc:frame` meta tags with dynamic images for rich social embeds.
- **Static vs Dynamic OG Images**: While dynamic Open Graph images are possible with Next.js ImageResponse, static images are more reliable and performant for Mini App embeds. Static images avoid generation complexity, load instantly, and don't require complex error handling.
- **Server-Side Metadata**: For dynamic meta tags in Next.js App Router, separate server components (for metadata) from client components (for interactivity). Use `generateMetadata()` function for dynamic `fc:frame` tags.
- **CRITICAL: Farcaster Mini App Sharing**: ⚠️ **NEVER use external URLs like `window.open(warpcastUrl)` for sharing within Farcaster Mini Apps!** This tries to open another app within the Mini App context. Instead, use the proper Farcaster SDK method `sdk.actions.composeCast({ text, embeds })` which will minimize the Mini App and open the native Farcaster composer. React hooks like `useFarcaster()` must be called at the component level, not inside event handlers.
- **CRITICAL: Follow Official Documentation Exactly**: ⚠️ **Always implement exactly as specified in official Farcaster documentation!** The [Farcaster Mini App Sharing docs](https://docs.farcaster.xyz/developers/guides/mini-apps/sharing) provide the exact format for `fc:frame` meta tags. Don't overcomplicate with async operations, complex error handling, or dynamic generation unless absolutely necessary. Simple, static implementations following the docs exactly are most reliable.
- **CRITICAL: Next.js Metadata API**: ⚠️ **The Next.js 14 metadata API works reliably when kept simple!** Use synchronous `generateMetadata()` functions without complex async operations. The `other` property works correctly for custom meta tags like `fc:frame` when the implementation follows the documentation patterns exactly.

## Next Steps

🎉 **PROJECT COMPLETE: Full-Featured Farcaster Mini App MVP**

**All Core Features Implemented**:
- ✅ **Product Browsing & Cart Management**
- ✅ **USDC Payment Integration on Base**
- ✅ **Shopify Order Creation & Management**
- ✅ **Enhanced UX with Google Maps Integration**
- ✅ **Viral Sharing System with Mini App Embeds**

**Optional Future Enhancements** (post-MVP):
1. **Collection Filtering**: Filter products by Shopify collections
2. **Order Tracking**: Display order status and tracking information
3. **User Profiles**: Save shipping addresses for repeat customers
4. **Analytics**: Track conversion rates, viral sharing metrics, and popular products
5. **Multi-Currency**: Support additional cryptocurrencies beyond USDC
6. **Dynamic Images**: Add dynamic OG image generation for product-specific embeds
7. **Social Features**: User reviews, product ratings, social proof

**Production Ready**: The application is 100% ready for production deployment with all core features working correctly, enhanced UX improvements, and a complete viral sharing system that will drive growth through Farcaster social feeds. 