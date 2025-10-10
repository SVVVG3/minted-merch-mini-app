import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database not available' 
      }, { status: 503 });
    }

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

export async function POST(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database not available' 
      }, { status: 503 });
    }

    const { action, username } = await request.json();

    if (action === 'search_username') {
      if (!username) {
        return NextResponse.json({
          success: false,
          error: 'Username is required'
        }, { status: 400 });
      }

      console.log('🔍 Searching for username:', username);

      // Search for users by username (case-insensitive)
      const { data: users, error } = await supabaseAdmin
        .from('profiles')
        .select('fid, username, display_name, pfp_url')
        .ilike('username', `%${username}%`)
        .limit(10);

      if (error) {
        console.error('Error searching users:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to search users'
        }, { status: 500 });
      }

      console.log(`✅ Found ${users.length} users matching "${username}"`);

      return NextResponse.json({
        success: true,
        users,
        count: users.length
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error in admin users POST API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 