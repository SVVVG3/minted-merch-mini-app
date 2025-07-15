import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client to bypass RLS for admin endpoints
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request) {
  try {
    console.log('Fetching all check-ins for admin dashboard...');

    // Fetch all daily check-ins from point_transactions table using service role
    const { data: checkins, error } = await supabaseAdmin
      .from('point_transactions')
      .select(`
        id,
        user_fid,
        username,
        points_earned,
        transaction_type,
        created_at
      `)
      .eq('transaction_type', 'daily_checkin')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching check-ins:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch check-ins' 
      }, { status: 500 });
    }

    console.log(`Fetched ${checkins.length} check-ins successfully`);

    return NextResponse.json({
      success: true,
      data: checkins || []
    });

  } catch (error) {
    console.error('Error in checkins API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 