# Farcaster Shopify Mini App - Project Scratchpad

## Background and Motivation

Building a Farcaster Mini App for https://mintedmerch.shop/ that allows users to shop directly inside Farcaster and pay using USDC via direct onchain wallet transfers. Using https://github.com/jc4p/shopify-mini-app-frame as the base template.

**Goal**: Complete MVP that enables:
- Product browsing inside Farcaster ✅
- Cart functionality ✅
- USDC payment flow ✅ **WORKING**
- Shopify order creation ✅ **WORKING**
- Enhanced UX features ✅ **COMPLETED**
- Viral sharing functionality ✅ **COMPLETED**

## Key Challenges and Analysis

- **Environment Setup**: ✅ COMPLETED - Shopify API credentials configured and working
- **Farcaster Integration**: ✅ COMPLETED - Mini App context and authentication working
- **Payment Flow**: ✅ COMPLETED - USDC payments execute successfully and cart clears
- **E-Commerce Checkout**: ✅ COMPLETED - 3-step checkout with shipping/tax calculation working
- **Order Management**: ✅ COMPLETED - Orders are being created successfully in Shopify
- **Google Maps Migration**: ✅ **COMPLETED** - Migrated to new PlaceAutocompleteElement API
- **UX Improvements**: ✅ **COMPLETED** - Fixed Google Maps clearing user data and "(Default Title)" display issues
- **Viral Sharing System**: ✅ **COMPLETED** - Product and order success sharing with Farcaster embeds

### Recent Major Feature: Viral Sharing System ✅ **COMPLETED**

**Implementation Overview**: Created a comprehensive viral sharing system that allows users to share products and order confirmations directly in Farcaster feeds with rich embeds.

**Feature 1: Product Page Sharing** ✅ **IMPLEMENTED**
- **Share Button**: Added share button to product page header next to cart button
- **Dynamic Meta Tags**: Implemented server-side metadata generation for each product page
- **Farcaster Frame Embeds**: Each product URL generates `fc:frame` meta tags with:
  - Dynamic product image via `/api/og/product?handle={handle}`
  - Product-specific call-to-action button: "🛒 Buy {Product} - ${price}"
  - Direct deep-link to product page in Mini App
- **Smart Sharing Logic**: 
  - ✅ **Farcaster Environment**: Opens Warpcast composer with pre-filled share text and URL
  - ✅ **Non-Farcaster Fallback**: Uses native Web Share API or clipboard copy
  - ✅ **Share Text**: "🛒 Check out this {product} for ${price} USDC! Shop crypto merch with instant payments on Base 🔵"

**Feature 2: Order Success Sharing** ✅ **IMPLEMENTED**
- **Share Purchase Button**: Added prominent "Share My Purchase" button on order confirmation
- **Order Celebration**: Encourages users to share their successful crypto purchases
- **Dynamic OG Images**: Order-specific images via `/api/og/order?order={number}&total={amount}`
- **Viral Share Text**: "🎉 Just bought crypto merch with USDC! Order {number} for ${total} confirmed ✅ Instant payments on Base 🔵"

**Feature 3: Dynamic Open Graph Images** ✅ **IMPLEMENTED**
- **Product Images**: `/api/og/product` route generates beautiful product cards with:
  - Product image, title, and price
  - Minted Merch branding
  - "Shop Now on Base" call-to-action
  - Professional dark theme with brand colors
- **Order Images**: `/api/og/order` route generates celebration images with:
  - Success checkmark and confirmation message
  - Order number and total amount
  - "Paid instantly on Base" messaging
  - Branded celebration design
- **Performance Optimized**: 5-minute cache headers for CDN optimization
- **Fallback Handling**: Graceful error handling with branded fallback images

**Technical Architecture**:
- **Server-Side Metadata**: Product pages use `generateMetadata()` for dynamic `fc:frame` tags
- **Edge Runtime**: OG image generation uses Next.js Edge Runtime for performance
- **Component Separation**: Split product page into server/client components for metadata support
- **Cross-Platform Sharing**: Intelligent detection of Farcaster vs. web environment
- **Error Resilience**: Comprehensive error handling and fallback mechanisms

**Viral Loop Implementation**:
1. **Discovery**: User sees shared product/order in Farcaster feed
2. **Engagement**: Rich embed with product image and clear CTA
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
- [x] **Task 28**: Create dynamic Open Graph image generation ✅ COMPLETED
- [x] **Task 29**: Implement cross-platform sharing logic ✅ COMPLETED

## Project Status Board

### ✅ Completed Tasks
- **All Phase 1-8 Tasks**: Complete MVP with viral sharing functionality
- **Task 26**: Product Page Sharing
  - ✅ Added share button to product detail header
  - ✅ Implemented server-side metadata generation with `generateMetadata()`
  - ✅ Created dynamic `fc:frame` meta tags for each product
  - ✅ Built `/api/og/product` route for dynamic product images
  - ✅ Integrated Farcaster-aware sharing logic with fallbacks
- **Task 27**: Order Success Sharing
  - ✅ Added "Share My Purchase" button to order confirmation
  - ✅ Created celebration sharing text for successful orders
  - ✅ Built `/api/og/order` route for order success images
  - ✅ Implemented cross-platform sharing with smart detection
- **Task 28**: Dynamic OG Images
  - ✅ Product cards with images, titles, prices, and branding
  - ✅ Order celebration images with success messaging
  - ✅ Edge runtime optimization with proper caching
  - ✅ Fallback handling for error scenarios
- **Task 29**: Cross-Platform Sharing
  - ✅ Farcaster environment detection and Warpcast integration
  - ✅ Web Share API fallback for compatible browsers
  - ✅ Clipboard copy fallback for all other scenarios
  - ✅ Comprehensive error handling and user feedback

### 🎉 **MVP COMPLETE + VIRAL SHARING** - All Core Features + Growth Engine Working

**✅ MAJOR MILESTONE ACHIEVED**: Complete Farcaster Mini App MVP with viral sharing system is fully functional!

**Core Features Working**:
- ✅ **Product Browsing**: Users can browse products inside Farcaster
- ✅ **Cart Management**: Add/remove items, view cart totals
- ✅ **USDC Payments**: Seamless onchain payments with proper Wagmi integration
- ✅ **Order Creation**: Orders successfully created in Shopify
- ✅ **Enhanced UX**: Google Maps autocomplete, correct totals, supported countries
- ✅ **Future-Proof**: Migrated to latest Google Maps APIs
- ✅ **Viral Sharing**: Product and order sharing with rich Farcaster embeds

**Viral Growth Engine**:
- ✅ **Product Sharing**: Every product page has viral sharing capability
- ✅ **Order Celebration**: Users encouraged to share successful purchases
- ✅ **Rich Embeds**: Beautiful, branded images for social feeds
- ✅ **Viral Loop**: Discovery → Purchase → Share → Discovery cycle

**Technical Stack**:
- ✅ **Frontend**: Next.js 14 with React components
- ✅ **Payments**: USDC on Base network via Wagmi
- ✅ **E-commerce**: Shopify Storefront + Admin APIs
- ✅ **Address Input**: Google Places API (New) with PlaceAutocompleteElement
- ✅ **Sharing**: Farcaster frame embeds with dynamic OG images
- ✅ **Deployment**: Vercel with proper environment configuration

**Current Status**: 
- ✅ **Payment Flow**: WORKING - USDC payments execute successfully
- ✅ **Order Creation**: WORKING - Orders created successfully in Shopify
- ✅ **Enhanced UX**: WORKING - All enhancements implemented and tested
- ✅ **API Compliance**: WORKING - No deprecation warnings, future-proofed
- ✅ **Viral Sharing**: WORKING - Complete sharing system with rich embeds

## Executor's Feedback or Assistance Requests

**🎉 MVP + VIRAL SHARING COMPLETION STATUS**

**All Critical Issues Resolved + Major Feature Added**:
- ✅ **Order Creation**: Fixed Shopify Admin API version compatibility and schema issues
- ✅ **Payment Flow**: Fixed Wagmi connector timing and version conflicts
- ✅ **Enhanced UX**: Implemented Google Maps autocomplete, correct totals, country filtering
- ✅ **API Migration**: Migrated to new Google Places API to eliminate deprecation warnings
- ✅ **Viral Sharing**: Complete sharing system with Farcaster embeds and dynamic images

**Final Implementation**:
- ✅ **Complete Checkout Flow**: 3-step process (address → shipping → payment) working perfectly
- ✅ **USDC Payments**: Base network integration with proper error handling
- ✅ **Order Management**: Successful Shopify order creation with all required fields
- ✅ **Address Autocomplete**: Modern Google Places API with global search and country filtering
- ✅ **Viral Growth Engine**: Product and order sharing with rich Farcaster frame embeds
- ✅ **Cross-Platform Sharing**: Smart detection and fallbacks for all environments
- ✅ **Production Ready**: All environment variables configured, APIs enabled, no warnings

**Expected Result**: 
The Farcaster Mini App is now **PRODUCTION READY WITH VIRAL GROWTH** featuring:
1. **Functional E-commerce** ✅ - Complete shopping experience
2. **USDC Payment Integration** ✅ - Seamless onchain payments
3. **Enhanced User Experience** ✅ - Address autocomplete, proper totals
4. **Future-Proof APIs** ✅ - Latest Google Maps implementation
5. **Error-Free Operation** ✅ - No console warnings or deprecation notices
6. **Viral Sharing System** ✅ - Product and order sharing with rich embeds
7. **Growth Engine** ✅ - Discovery → Purchase → Share viral loop

**Next Action**: The MVP with viral sharing is complete and ready for production use. The viral sharing system will help drive organic growth through Farcaster social feeds.

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
- **Dynamic OG Images**: Use Next.js ImageResponse with Edge Runtime for dynamic Open Graph images. Always include proper cache headers (`max-age=300`) and fallback error handling to prevent gray images in social feeds.
- **Server-Side Metadata**: For dynamic meta tags in Next.js App Router, separate server components (for metadata) from client components (for interactivity). Use `generateMetadata()` function for dynamic `fc:frame` tags.

## Next Steps

✅ **MVP + VIRAL SHARING COMPLETE** - All core functionality and growth engine implemented

**Optional Future Enhancements** (not required for MVP):
1. **Collection Filtering**: Filter products by Shopify collections
2. **Order Tracking**: Display order status and tracking information
3. **User Profiles**: Save shipping addresses for repeat customers
4. **Analytics**: Track conversion rates, viral sharing metrics, and popular products
5. **Multi-Currency**: Support additional cryptocurrencies beyond USDC
6. **Advanced Sharing**: A/B test sharing messages, track viral coefficients
7. **Social Features**: User reviews, product ratings, social proof

**Production Deployment**: The application is ready for production use with all core features working correctly, enhanced UX improvements, and a complete viral sharing system that will drive organic growth through Farcaster social feeds. 