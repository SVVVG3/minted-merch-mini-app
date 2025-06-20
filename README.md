# Shopify Mini App Frame

A Farcaster frame for shopping with USDC on Base. This boilerplate allows anyone to create a mobile-first e-commerce experience integrated with Shopify and cryptocurrency payments.

## Features

- 🛍️ Shopify integration for product catalog
- 🎯 Farcaster frame compatibility
- 💰 USDC payments on Base network
- 📱 Mobile-first design
- 🎨 Customizable theme system
- ⚡ Server-side rendering with Next.js
- 🔐 Frame authentication

## Prerequisites

- Node.js 18+ or Bun
- Shopify store with Admin API access
- Farcaster account for testing frames

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/shopify-mini-app-frame.git
cd shopify-mini-app-frame
```

2. Install dependencies:
```bash
bun install
# or
npm install
```

3. Configure environment variables:
Create a `.env` file with the following variables:

```env
# Shopify Configuration
SHOPIFY_SITE_DOMAIN=your-store-name
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
TARGET_COLLECTION_HANDLE=all

# Payment Configuration
PAYMENT_RECIPIENT_ADDRESS=0xYourWalletAddress
NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS=0xYourWalletAddress

# Optional: Google Maps API for address autocomplete
GOOGLE_MAPS_API_KEY=your-api-key
```

4. Run the development server:
```bash
bun dev
# or
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Customization

### Theme
Edit `src/styles/theme.css` to customize:
- Colors
- Typography
- Spacing
- Shadows
- Border radius

### Shopify Store
1. Update `SHOPIFY_SITE_DOMAIN` to your store's subdomain
2. Generate an Admin API access token from your Shopify admin
3. Set `TARGET_COLLECTION_HANDLE` to display a specific collection

### Payment Recipient
Update `PAYMENT_RECIPIENT_ADDRESS` to your wallet address where USDC payments should be sent.

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   ├── product/          # Product detail pages
│   ├── layout.js         # Root layout
│   └── page.js           # Homepage
├── components/           # React components
├── lib/                  # Utility functions
│   ├── frame.js          # Farcaster frame SDK
│   ├── shopify.js        # Shopify API client
│   └── theme.js          # Theme configuration
└── styles/              # CSS files
```

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Frame Metadata
Update the frame metadata in `src/app/page.js`:
- `imageUrl`: Preview image for your frame
- `url`: Your deployed app URL
- `splashImageUrl`: Loading screen image

## Testing in Farcaster

1. Deploy your app
2. Share the URL in Warpcast
3. The frame preview should appear
4. Click "Shop Now!" to launch the frame

## License

MIT
