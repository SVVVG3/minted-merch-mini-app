import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';

export async function GET() {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const vercelUrl = process.env.VERCEL_URL;
    
    return NextResponse.json({
      success: true,
      environment: {
        NEXT_PUBLIC_APP_URL: appUrl || 'NOT SET',
        VERCEL_URL: vercelUrl || 'NOT SET',
        fallback: 'https://mintedmerch.vercel.app'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 