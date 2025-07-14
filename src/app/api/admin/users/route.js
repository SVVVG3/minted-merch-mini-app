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
    console.log('Fetching all users for admin dashboard...');

    // Fetch all users from profiles table with their orders using service role
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        orders:orders(
          amount_total
        )
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch users' 
      }, { status: 500 });
    }

    // Calculate aggregated data for each user
    const usersWithStats = users.map(user => {
      const orders = user.orders || [];
      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, order) => sum + (parseFloat(order.amount_total) || 0), 0);

      return {
        ...user,
        total_orders: totalOrders,
        total_spent: totalSpent.toFixed(2),
        // Remove the raw orders array
        orders: undefined
      };
    });

    console.log(`Fetched ${usersWithStats.length} users successfully`);

    return NextResponse.json({
      success: true,
      data: usersWithStats
    });

  } catch (error) {
    console.error('Error in admin users API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 