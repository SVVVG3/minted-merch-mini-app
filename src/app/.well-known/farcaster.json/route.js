import { NextResponse } from 'next/server';

// Account associations for different domains
const OLD_DOMAIN_ASSOCIATION = {
  "header": "eyJmaWQiOjQ2NjExMSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDQ0ZDRjNThlZmNCYjQ0NjM5RDY0NDIwMTc1Q2Y1MTlhQTMxOTFhODYifQ",
  "payload": "eyJkb21haW4iOiJtaW50ZWRtZXJjaC52ZXJjZWwuYXBwIn0",
  "signature": "MHg4ZjhjMzQ5MWU4MjQ1YzA4ZWEyZWIyYjIwOGUzMjc0MDQ5ZGJkOTE0NjU2MTE1ZWY3MDU4MzYwZGVjYzU4Y2NhNGNmODFiYzI3MjdjN2FlZGNiZmRiNGU3ZmNkZTU0YWYyMTI0OGI0NTc2MTFmNDQ4Njg0NTIyMmUwYzlhYjM1MjFi"
};

const NEW_DOMAIN_ASSOCIATION = {
  "header": "eyJmaWQiOjQ2NjExMSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDQ0ZDRjNThlZmNCYjQ0NjM5RDY0NDIwMTc1Q2Y1MTlhQTMxOTFhODYifQ",
  "payload": "eyJkb21haW4iOiJhcHAubWludGVkbWVyY2guc2hvcCJ9",
  "signature": "MHgzZGEwNjgxZDMyMWM5NTZkMmQzYTAxOWRiZjEwYWU3YzQ5YTEyNTNiYjQxYmYwMjUwNWVmMzFjY2EyMzgyMjQ0Nzk4ZTIwMzNlYThmNWQ5MDdjYjE1NzU3Mjk0MzIwMjVmMDk3OTI0NjRhOGFhOTZlYjU2NDdiMGIwMjI0NmEyNDFi"
};

export async function GET(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  
  console.log('🔍 Farcaster manifest requested from host:', host);
  
  // Determine which domain is being accessed
  const isOldDomain = host === 'mintedmerch.vercel.app';
  const isNewDomain = host === 'app.mintedmerch.shop';
  
  let manifest;
  
  if (isOldDomain) {
    // OLD DOMAIN: Point to new domain with canonicalDomain
    manifest = {
      "accountAssociation": OLD_DOMAIN_ASSOCIATION,
      "miniapp": {
        "version": "1",
        "name": "Minted Merch",
        "iconUrl": "https://mintedmerch.vercel.app/logo.png",
        "homeUrl": "https://mintedmerch.vercel.app",
        "imageUrl": "https://mintedmerch.vercel.app/og-image.png",
        "buttonTitle": "Shop Now 📦",
        "splashImageUrl": "https://mintedmerch.vercel.app/splash.png",
        "splashBackgroundColor": "#000000",
        "canonicalDomain": "app.mintedmerch.shop"
      }
    };
  } else {
    // NEW DOMAIN: Self-referential canonicalDomain
    manifest = {
      "accountAssociation": NEW_DOMAIN_ASSOCIATION,
      "miniapp": {
        "version": "1",
        "name": "Minted Merch",
        "iconUrl": "https://app.mintedmerch.shop/logo.png",
        "homeUrl": "https://app.mintedmerch.shop",
        "imageUrl": "https://app.mintedmerch.shop/og-image.png",
        "buttonTitle": "Shop Now 📦",
        "splashImageUrl": "https://app.mintedmerch.shop/splash.png",
        "splashBackgroundColor": "#000000",
        "canonicalDomain": "app.mintedmerch.shop"
      }
    };
  }
  
  console.log('📋 Serving manifest for:', isOldDomain ? 'OLD domain (with migration)' : 'NEW domain');
  
  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // 5 minute cache
    },
  });
}
