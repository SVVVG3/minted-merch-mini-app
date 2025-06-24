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
- [x] **Task 8**: Display Farcaster user info on page ✅ COMPLETED

### Phase 4 — Cart Functionality
- [x] **Task 9**: Build CartContext for cart state management ✅ COMPLETED
- [x] **Task 10**: Build cart UI component ✅ COMPLETED
- [x] **Task 11**: UI/UX Improvements & Cart Enhancements ✅ COMPLETED

### Phase 5 — Payment Flow
- [ ] **Task 12**: Render USDC payment instructions
- [ ] **Task 13**: Build confirmation screen (success page)

### Phase 6 — Shopify Order Creation
- [ ] **Task 14**: Build Shopify Admin API client
- [ ] **Task 15**: Build API route to create Shopify orders
- [ ] **Task 16**: Manually trigger order creation after payment (for MVP)

### Phase 7 — Final MVP Readiness
- [ ] **Task 17**: Test full end-to-end MVP flow
- [ ] **Task 18**: Prepare production deployment

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
  - ✅ **FIXED**: Updated accountAssociation with proper JWT header and signature
  - ✅ **FIXED**: Removed special characters (&) from manifest description to pass validation
  - ✅ **FIXED**: Button title consistency between Frame metadata and manifest (added emoji)
  - ✅ Code deployed to production at https://mintedmerch.vercel.app/

- **Task 8**: Farcaster user info display
  - ✅ FarcasterHeader component created and integrated into layout
  - ✅ Component displays user info when in Farcaster context
  - ✅ useFarcaster hook provides easy access to Farcaster context throughout app
  - ✅ Gracefully handles non-Farcaster environments
  - ✅ Production deployment complete

- **Task 9**: Build CartContext for cart state management
  - ✅ Created comprehensive CartContext (`src/lib/CartContext.js`) with:
    - useReducer for state management
    - Cart actions: ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY, CLEAR_CART, LOAD_CART
    - localStorage persistence for cart data
    - Helper functions: isInCart, getItemQuantity, cartTotal, itemCount
    - Proper product/variant handling with unique item keys
  - ✅ Integrated CartProvider into app layout (`src/app/layout.js`)
  - ✅ Updated ProductDetail component to use CartContext with "Add to Cart" functionality
  - ✅ Fixed import error in payment.js (frame.sdk → sdk)
  - ✅ Cart state properly persists across page refreshes
  - ✅ Ready for cart UI implementation (Task 10)

- **Task 10**: Build cart UI component ✅ COMPLETED
  - ✅ Created comprehensive Cart component (`src/components/Cart.jsx`)
  - ✅ Implemented sliding cart sidebar with backdrop
  - ✅ Added cart header with item count and close button
  - ✅ Built empty cart state with friendly messaging
  - ✅ Created detailed CartItem component with product images, titles, and prices
  - ✅ Added quantity controls (increment/decrement buttons)
  - ✅ Implemented remove item functionality with confirmation
  - ✅ Added cart total calculation and display
  - ✅ Built "Clear Cart" functionality with confirmation dialog
  - ✅ Added "Checkout with USDC" button (placeholder for Phase 5)
  - ✅ Updated CartIndicator to be a floating cart trigger button
  - ✅ Added cart item count badge on cart button
  - ✅ Integrated cart preview showing total price
  - ✅ Updated ProductCard components with "Add to Cart" buttons
  - ✅ Added "In Cart" status indication on product cards
  - ✅ Enhanced Shopify API queries to include variant data
  - ✅ All cart functionality tested and working in browser

- **Task 11**: UI/UX Improvements & Cart Enhancements ✅ COMPLETED
  - ✅ **FarcasterHeader Message Update**: Changed welcome message to "Hey, {username} - welcome to Minted Merch! 👋"
  - ✅ **Product Description Enhancement**: 
    - Moved description to dedicated white card with shadow and border
    - Added proper paragraph formatting with line breaks
    - Implemented bold text parsing for **text** formatting
    - Increased font size and improved typography
    - Added proper spacing and visual hierarchy
    - Used prose styling for better readability
  - ✅ **Cart Notes Section**: 
    - Added notes field to CartContext state management
    - Created UPDATE_NOTES action and reducer case
    - Added textarea in cart for order notes/special instructions
    - Included helpful placeholder text for NFT customization
    - Notes persist in localStorage with cart data
    - Notes are cleared when cart is cleared
  - ✅ **Clear Cart Button Fix**: 
    - Fixed Clear Cart functionality to properly reset cart state
    - Enhanced confirmation dialog to mention notes will also be cleared
    - Added proper state management for local notes
    - Fixed button styling and positioning
    - Updated brand colors throughout cart (blue → green #3eb489)

### 🔄 Current Status / Progress Tracking

✅ **Phase 4 Complete + UI/UX Enhancements** - Cart Functionality & Improvements
- Cart state management with CartContext ✅
- Comprehensive cart UI with sidebar ✅
- Add/remove/update cart items ✅
- Cart persistence via localStorage ✅
- Product cards with cart integration ✅
- **NEW**: Enhanced product description layout ✅
- **NEW**: Cart notes section for special instructions ✅
- **NEW**: Fixed Clear Cart button functionality ✅
- **NEW**: Updated Farcaster header welcome message ✅
- **NEW**: Consistent brand colors (#3eb489) throughout UI ✅
- Ready for USDC payment integration ✅

**Next: Phase 5 - USDC Payment Integration**
- Task 12: Implement USDC payment flow using Base network
- Task 13: Connect with Farcaster wallet
- Task 14: Handle payment confirmation and order creation

**Phase 4 Status**: ✅ **COMPLETE WITH ENHANCEMENTS!** 🎉 

**Farcaster Mini App Registration Ready**: 
- ✅ Manifest URL: https://mintedmerch.vercel.app/.well-known/farcaster.json
- ✅ Account association properly configured with JWT header and signature
- ✅ All validation errors resolved (special characters, button title consistency)
- ✅ Custom branding integrated (MintedMerch logo, splash, OG images)
- ✅ Ready for submission to Farcaster Mini App registry

**Deployment Status**: 
- ✅ Local dev: http://localhost:3000
- ✅ Production: https://mintedmerch.vercel.app/
- ✅ Shopify API connected and working perfectly
- ✅ 13+ products displaying with correct images and prices
- ✅ Individual product pages working with proper variant pricing
- ✅ All price display issues resolved
- ✅ Farcaster Mini App SDK integrated and deployed
- ✅ Farcaster user context properly handled and displayed
- ✅ Enhanced product descriptions with proper formatting
- ✅ Cart with notes section and fixed Clear Cart functionality
- 🎯 Ready for Phase 5: USDC Payment Integration

### 🚧 Blocked/Waiting
- None currently

## Executor's Feedback or Assistance Requests

**Phase 4 Complete with Major UI/UX Enhancements! 🎉**

**Latest Improvements Completed:**
1. ✅ **FarcasterHeader Message**: Updated to "Hey, {username} - welcome to Minted Merch! 👋"
2. ✅ **Enhanced Product Descriptions**: 
   - Beautiful white card layout with shadow and border
   - Proper paragraph formatting with line breaks
   - Bold text parsing for **emphasized text**
   - Improved typography and spacing
   - Much more readable and professional appearance
3. ✅ **Cart Notes Section**: 
   - Added order notes textarea in cart
   - Helpful placeholder text for NFT customization requests
   - Integrated with CartContext state management
   - Persists in localStorage with cart data
4. ✅ **Fixed Clear Cart Button**: 
   - Properly clears all cart items and notes
   - Enhanced confirmation dialog
   - Fixed state management issues
   - Updated to use brand colors (#3eb489)

**Current Status**: 
- ✅ All 4 user requests completed successfully
- ✅ Cart functionality fully working with notes support
- ✅ Product pages now have beautiful, readable descriptions
- ✅ Farcaster header displays proper welcome message
- ✅ Consistent brand styling throughout the app
- ✅ Ready for user testing and Phase 5 (USDC payments)

**Ready for Next Phase**: USDC Payment Integration using Base network

## Lessons

- Include info useful for debugging in the program output.
- Read the file before you try to edit it.
- If there are vulnerabilities that appear in the terminal, run npm audit before proceeding
- Always ask before using the -force git command
- **Cart State Management**: When adding new fields to cart state (like notes), ensure all reducer cases handle the new field properly, especially CLEAR_CART and LOAD_CART actions
- **UI Consistency**: Apply brand colors (#3eb489) consistently across all interactive elements for better user experience
- **Product Description Formatting**: Use proper card layouts with shadows and borders to make content more readable and professional-looking
- **Local State vs Context**: When using both local state and context for form inputs (like cart notes), ensure they stay in sync and update together

## Next Steps

1. User should test localhost:3000 to confirm setup
2. Commit Task 1 completion to GitHub  
3. Proceed to Task 2: Setup Vercel project 