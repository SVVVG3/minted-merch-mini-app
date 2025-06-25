# Farcaster Shopify Mini App - Project Scratchpad

## Background and Motivation

Building a Farcaster Mini App for https://mintedmerch.shop/ that allows users to shop directly inside Farcaster and pay using USDC via direct onchain wallet transfers. Using https://github.com/jc4p/shopify-mini-app-frame as the base template.

**Goal**: Complete MVP that enables:
- Product browsing inside Farcaster ✅
- Cart functionality ✅
- USDC payment flow ✅ **WORKING**
- Shopify order creation ✅ **WORKING**
- Enhanced UX features ✅ **COMPLETED**
- Viral sharing functionality ⚠️ **ISSUES IDENTIFIED**

## Key Challenges and Analysis

- **Environment Setup**: ✅ COMPLETED - Shopify API credentials configured and working
- **Farcaster Integration**: ✅ COMPLETED - Mini App context and authentication working
- **Payment Flow**: ✅ COMPLETED - USDC payments execute successfully and cart clears
- **E-Commerce Checkout**: ✅ COMPLETED - 3-step checkout with shipping/tax calculation working
- **Order Management**: ✅ COMPLETED - Orders are being created successfully in Shopify
- **Google Maps Migration**: ✅ **COMPLETED** - Migrated to new PlaceAutocompleteElement API
- **UX Improvements**: ✅ **COMPLETED** - Fixed Google Maps clearing user data and "(Default Title)" display issues
- **Viral Sharing System**: ⚠️ **DEBUGGING** - Mini App embeds inconsistent, some products not generating embeds

### Current Issue: Inconsistent Mini App Embeds ⚠️ **DEBUGGING**

**Problem**: User reports that some products are not generating Mini App embeds at all, and some are showing old placeholder images instead of the new rich product cards.

**Root Cause Analysis**:
1. **Metadata Generation Failure**: The `generateMetadata` function is falling back to error case
2. **Missing fc:frame Meta Tags**: No `fc:frame` meta tags are being generated in the HTML
3. **Next.js Metadata API Limitations**: The `other` property may not work as expected for custom meta tags
4. **Cache Issues**: Farcaster may be caching old metadata for previously shared URLs

**Official Repository Insights**:
- **[farcasterxyz/mini-app-img-next](https://github.com/farcasterxyz/mini-app-img-next)**: Official Farcaster repository for Mini App image generation
- **[builders-garden/miniapp-next-template](https://github.com/builders-garden/miniapp-next-template)**: Community template with working dynamic image examples
- **Key Patterns**:
  - Use proper caching headers: `Cache-Control: public, immutable, no-transform, max-age=31536000`
  - Query parameter approach for dynamic content: `?title=Title&description=Description`
  - Next.js ImageResponse with Edge Runtime
  - Official documentation reference for Mini App embed format

**Technical Investigation**:
- ✅ **OG Image Generation**: Working correctly at `/api/og/product?handle=bankr-cap`
- ❌ **Metadata Generation**: Falling back to error case (title: "Minted Merch Shop" instead of product-specific)
- ❌ **fc:frame Meta Tags**: Not appearing in HTML response
- ✅ **Cache Headers**: Updated to follow official patterns (max-age=31536000)
- ✅ **Image Design**: Improved with branded product cards

**Next Steps for Resolution**:
1. **Debug Metadata Generation**: Fix the `generateMetadata` function error
2. **Alternative Meta Tag Approach**: If Next.js metadata API doesn't work, use alternative method
3. **Follow Official Patterns**: Implement exactly like farcasterxyz/mini-app-img-next
4. **Test with Fresh URLs**: Use cache-busting parameters for testing

### Recent Major Feature: Viral Sharing System ⚠️ **DEBUGGING**

**Implementation Overview**: Created a comprehensive viral sharing system that allows users to share products and order confirmations directly in Farcaster feeds with rich embeds.

**Feature 1: Product Page Sharing** ⚠️ **DEBUGGING**
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

**Feature 3: Dynamic Open Graph Images** ✅ **IMPROVED**
- **Product Images**: `/api/og/product` route generates beautiful product cards with:
  - Rich branded design with shopping cart icon
  - Product title and USDC price
  - "Shop crypto merch with instant payments" messaging
  - Professional dark theme with brand colors (#3eb489)
  - Follows official Farcaster caching patterns (max-age=31536000)
- **Order Images**: `/api/og/order` route generates celebration images with:
  - Success checkmark and confirmation message
  - Order number and total amount
  - "Paid instantly on Base" messaging
  - Branded celebration design
- **Performance Optimized**: Long cache headers for CDN optimization following official patterns
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

### Phase 8 — Viral Sharing System ⚠️ **DEBUGGING**
- [x] **Task 26**: Implement product page sharing with Farcaster embeds ⚠️ DEBUGGING
- [x] **Task 27**: Add order success sharing functionality ✅ COMPLETED
- [x] **Task 28**: Create dynamic Open Graph image generation ✅ COMPLETED
- [x] **Task 29**: Implement cross-platform sharing logic ✅ COMPLETED
- [ ] **Task 30**: Debug and fix Mini App embed generation issues ⚠️ IN PROGRESS

## Project Status Board

### ⚠️ Current Priority: Fix Mini App Embed Issues

**Issue**: Some products not generating Mini App embeds, metadata generation failing

**Investigation Status**:
- ❌ **fc:frame Meta Tags**: Not appearing in HTML response
- ❌ **Metadata Generation**: Function throwing errors, falling back to generic metadata
- ✅ **OG Image Generation**: Working correctly with official Farcaster patterns
- ✅ **Share Button Logic**: Working correctly with SDK integration
- ✅ **Cache Headers**: Updated to follow official patterns (max-age=31536000)

**Next Actions**:
1. **Debug generateMetadata Function**: Identify why it's throwing errors
2. **Alternative Meta Tag Approach**: If Next.js metadata API is limited, use manual injection
3. **Follow Official Examples**: Implement exactly like farcasterxyz/mini-app-img-next
4. **Test with Cache Busting**: Verify fresh URLs work correctly

### ✅ Completed Tasks
- **All Phase 1-7 Tasks**: Complete MVP with enhanced UX features
- **Task 27**: Order Success Sharing - Working correctly
- **Task 28**: Dynamic OG Images - Improved with official patterns  
- **Task 29**: Cross-Platform Sharing - Working correctly

### 🎯 **MVP Status: 95% COMPLETE** - Core functionality working, debugging viral sharing

**Core Features Working**:
- ✅ **Product Browsing**: Users can browse products inside Farcaster
- ✅ **Cart Management**: Add/remove items, view cart totals
- ✅ **USDC Payments**: Seamless onchain payments with proper Wagmi integration
- ✅ **Order Creation**: Orders successfully created in Shopify
- ✅ **Enhanced UX**: Google Maps autocomplete, correct totals, supported countries
- ✅ **Future-Proof**: Migrated to latest Google Maps APIs
- ⚠️ **Viral Sharing**: Partially working - order sharing works, product sharing needs debugging

**Technical Stack**:
- ✅ **Frontend**: Next.js 14 with React components
- ✅ **Payments**: USDC on Base network via Wagmi
- ✅ **E-commerce**: Shopify Storefront + Admin APIs
- ✅ **Address Input**: Google Places API (New) with PlaceAutocompleteElement
- ⚠️ **Sharing**: Farcaster frame embeds with dynamic OG images (debugging metadata generation)
- ✅ **Deployment**: Vercel with proper environment configuration

**Current Status**: 
- ✅ **Payment Flow**: WORKING - USDC payments execute successfully
- ✅ **Order Creation**: WORKING - Orders created successfully in Shopify
- ✅ **Enhanced UX**: WORKING - All enhancements implemented and tested
- ✅ **API Compliance**: WORKING - No deprecation warnings, future-proofed
- ⚠️ **Viral Sharing**: DEBUGGING - Order sharing works, product sharing metadata issues

## Executor's Feedback or Assistance Requests

**🚨 URGENT: Mini App Embed Generation Issues**

**Current Problem**: Product sharing not generating proper Mini App embeds consistently. User reports some products show no embeds, others show old placeholders.

**Technical Analysis**:
- **Root Cause**: `generateMetadata` function is failing and falling back to error case
- **Evidence**: HTML shows generic "Minted Merch Shop" title instead of product-specific metadata
- **Missing**: No `fc:frame` meta tags in HTML response
- **Working**: OG image generation, order sharing, share button functionality

**Official Repository Insights**:
- **[farcasterxyz/mini-app-img-next](https://github.com/farcasterxyz/mini-app-img-next)**: Shows proper caching and query parameter patterns
- **[builders-garden/miniapp-next-template](https://github.com/builders-garden/miniapp-next-template)**: Has working dynamic image examples

**Immediate Next Steps**:
1. **Debug generateMetadata Function**: Find why it's throwing errors
2. **Test Alternative Approaches**: If Next.js metadata API is limited, implement manual meta tag injection
3. **Follow Official Patterns**: Implement exactly like the official repositories
4. **Verify with Fresh URLs**: Test with cache-busting parameters

**Expected Resolution**: Once metadata generation is fixed, Mini App embeds should work consistently for all products, completing the viral sharing system.

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
- **Dynamic OG Images**: Use Next.js ImageResponse with Edge Runtime for dynamic Open Graph images. Always include proper cache headers (`max-age=31536000` for official Farcaster patterns) and fallback error handling to prevent gray images in social feeds.
- **Server-Side Metadata**: For dynamic meta tags in Next.js App Router, separate server components (for metadata) from client components (for interactivity). Use `generateMetadata()` function for dynamic `fc:frame` tags.
- **CRITICAL: Farcaster Mini App Sharing**: ⚠️ **NEVER use external URLs like `window.open(warpcastUrl)` for sharing within Farcaster Mini Apps!** This tries to open another app within the Mini App context. Instead, use the proper Farcaster SDK method `sdk.actions.composeCast({ text, embeds })` which will minimize the Mini App and open the native Farcaster composer. React hooks like `useFarcaster()` must be called at the component level, not inside event handlers.
- **CRITICAL: Mini App Embed Format**: ⚠️ **Mini App embeds use a completely different format than old Farcaster frames!** For Mini Apps, use a single JSON object in the `fc:frame` meta tag: `<meta name="fc:frame" content="<stringified FrameEmbed JSON>" />` with format `{version: "next", imageUrl: "...", button: {title: "...", action: {type: "launch_frame", url: "...", name: "...", splashImageUrl: "...", splashBackgroundColor: "..."}}}`. Do NOT use individual meta tags like `fc:frame:image`, `fc:frame:button:1`, etc. - those are for old frames, not Mini Apps.
- **CRITICAL: Official Farcaster Patterns**: ⚠️ **Always follow official Farcaster repository patterns for Mini App implementations!** The [farcasterxyz/mini-app-img-next](https://github.com/farcasterxyz/mini-app-img-next) repository shows the correct caching headers (`max-age=31536000`), query parameter approaches, and Edge Runtime patterns. Community templates like [builders-garden/miniapp-next-template](https://github.com/builders-garden/miniapp-next-template) provide working examples of dynamic image generation and metadata handling.
- **Next.js Metadata API Limitations**: ⚠️ **The Next.js 14 metadata API `other` property may not work reliably for custom meta tags like `fc:frame`!** If the metadata API fails to generate custom meta tags, consider alternative approaches like manual meta tag injection or server-side HTML modification. Always verify that custom meta tags appear in the final HTML response.

## Next Steps

⚠️ **IMMEDIATE PRIORITY: Fix Mini App Embed Generation**

**Current Issue**: Product sharing not generating consistent Mini App embeds due to metadata generation failures.

**Debug Plan**:
1. **Identify generateMetadata Error**: Add logging to find why the function is throwing errors
2. **Test Alternative Meta Tag Methods**: If Next.js metadata API is limited, implement manual injection
3. **Follow Official Patterns**: Implement exactly like farcasterxyz/mini-app-img-next
4. **Verify Fresh URL Testing**: Ensure cache-busting parameters work correctly

**Optional Future Enhancements** (after fixing viral sharing):
1. **Collection Filtering**: Filter products by Shopify collections
2. **Order Tracking**: Display order status and tracking information
3. **User Profiles**: Save shipping addresses for repeat customers
4. **Analytics**: Track conversion rates, viral sharing metrics, and popular products
5. **Multi-Currency**: Support additional cryptocurrencies beyond USDC
6. **Advanced Sharing**: A/B test sharing messages, track viral coefficients
7. **Social Features**: User reviews, product ratings, social proof

**Production Deployment**: The application is 95% ready for production with all core features working correctly and enhanced UX improvements. Once the viral sharing metadata issue is resolved, it will have a complete growth engine through Farcaster social feeds. 