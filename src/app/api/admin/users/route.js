import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('Fetching all users for admin dashboard...');

    // Fetch all users from profiles table with aggregated order data
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        *,
        orders:orders(
          count,
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