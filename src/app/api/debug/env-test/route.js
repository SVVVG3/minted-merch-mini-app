import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    return NextResponse.json({
      success: true,
      environment: {
        supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET',
        supabaseKey: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'NOT SET',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        bothSet: !!(supabaseUrl && supabaseKey)
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 