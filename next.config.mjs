/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SPIN_REGISTRY_CONTRACT_ADDRESS: process.env.SPIN_REGISTRY_CONTRACT_ADDRESS,
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Existing COOP/COEP headers for wallet connectivity
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
          
          // 🔒 SECURITY HEADERS - OWASP Recommended
          
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          
          // Enable browser XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          
          // Enforce HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          
          // Permissions Policy (formerly Feature Policy)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          
          // Content Security Policy (CSP)
          // Note: Relaxed for Shopify, Farcaster, wallet connectors, and inline styles
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://*.warpcast.com https://*.farcaster.xyz https://cdn.shopify.com https://imagedelivery.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.shopify.com https://*.warpcast.com https://*.farcaster.xyz https://*.alchemy.com https://*.infura.io https://api.dexscreener.com https://api.zapper.xyz https://imagedelivery.net https://wrpcd.net https://*.wrpcd.net wss://*.alchemy.com wss://*.infura.io",
              "frame-src 'self' https://*.shopify.com https://*.warpcast.com https://*.farcaster.xyz",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self' https://*.warpcast.com https://*.farcaster.xyz https://warpcast.com https://farcaster.xyz https://wallet.farcaster.xyz",
              "upgrade-insecure-requests"
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
