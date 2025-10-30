import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host');
  
  // Check if this is the old domain
  if (host === 'mintedmerch.vercel.app') {
    console.log('🔄 Redirecting from old domain to new domain:', url.pathname);
    
    // Redirect to new domain with same path
    url.host = 'app.mintedmerch.shop';
    url.protocol = 'https:';
    
    return NextResponse.redirect(url, 301); // Permanent redirect
  }
  
  // Continue normally for new domain
  return NextResponse.next();
}

export const config = {
  // Apply to all routes except API routes, static files, and the farcaster manifest
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .well-known/farcaster.json (let our API route handle this)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|\\.well-known/farcaster\\.json).*)',
  ],
};
