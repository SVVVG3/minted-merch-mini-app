import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database not available' 
      }, { status: 503 });
    }

    // Parse search parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const searchType = searchParams.get('searchType') || 'all'; // 'fid', 'username', or 'all'
    const limit = parseInt(searchParams.get('limit') || '100');

    // If search query provided, do a search
    if (search && search.trim().length >= 1) {
      console.log(`🔍 Searching users: "${search}" (type: ${searchType})`);
      
      let query = supabaseAdmin
        .from('profiles')
        .select('fid, username, display_name, pfp_url, token_balance, staked_balance, created_at');

      if (searchType === 'fid') {
        // Search by FID (exact or starts with)
        const fidNum = parseInt(search);
        if (!isNaN(fidNum)) {
          query = query.eq('fid', fidNum);
        } else {
          return NextResponse.json({ success: true, data: [] });
        }
      } else if (searchType === 'username') {
        // Search by username (case-insensitive partial match)
        query = query.ilike('username', `%${search}%`);
      } else {
        // Search both - try FID first if numeric, otherwise username
        const fidNum = parseInt(search);
        if (!isNaN(fidNum)) {
          // Search by FID
          query = query.eq('fid', fidNum);
        } else {
          // Search by username
          query = query.ilike('username', `%${search}%`);
        }
      }

      const { data: users, error } = await query.limit(limit);

      if (error) {
        console.error('Error searching users:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to search users' 
        }, { status: 500 });
      }

      console.log(`✅ Found ${users?.length || 0} users matching "${search}"`);

      return NextResponse.json({
        success: true,
        data: users || []
      });
    }

    // No search - fetch all users (existing behavior)
    console.log('Fetching all users for admin dashboard...');

    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        orders:orders(
          amount_total
        )
      `)
      .order('updated_at', { ascending: false })
      .limit(limit);

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
});

export const POST = withAdminAuth(async (request) => {
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
});
