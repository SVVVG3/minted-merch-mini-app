import { NextResponse } from 'next/server';

export async function GET(request) {
  // Only allow this in development or with a specific debug key
  const { searchParams } = new URL(request.url);
  const debugKey = searchParams.get('key');
  
  // Simple security check - only expose in development or with correct key
  if (process.env.NODE_ENV === 'production' && debugKey !== 'debug123') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const envCheck = {
    NODE_ENV: process.env.NODE_ENV,
    SHOPIFY_SITE_DOMAIN: !!process.env.SHOPIFY_SITE_DOMAIN,
    SHOPIFY_ACCESS_TOKEN: !!process.env.SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_ADMIN_ACCESS_TOKEN: !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    VERCEL_URL: process.env.VERCEL_URL,
    // Show actual values for debugging (be careful in production)
    SHOPIFY_SITE_DOMAIN_VALUE: process.env.SHOPIFY_SITE_DOMAIN,
    SHOPIFY_ACCESS_TOKEN_LENGTH: process.env.SHOPIFY_ACCESS_TOKEN?.length || 0,
    SHOPIFY_ADMIN_ACCESS_TOKEN_LENGTH: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.length || 0
  };

  return NextResponse.json({
    message: 'Environment variables check',
    environment: envCheck,
    timestamp: new Date().toISOString()
  });
} 