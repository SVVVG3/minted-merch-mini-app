import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { userFid, recalculateAll = false } = await request.json();

    console.log('🔄 Starting points recalculation:', { userFid, recalculateAll });

    let usersToUpdate = [];

    if (recalculateAll) {
      // Get all users who have made purchases
      const { data: users, error } = await supabaseAdmin
        .from('user_leaderboard')
        .select('user_fid, total_spent, points_from_checkins')
        .gt('total_spent', 0);

      if (error) {
        console.error('Error fetching users for recalculation:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
      }

      usersToUpdate = users;
    } else if (userFid) {
      // Get specific user
      const { data: user, error } = await supabaseAdmin
        .from('user_leaderboard')
        .select('user_fid, total_spent, points_from_checkins')
        .eq('user_fid', userFid)
        .single();

      if (error) {
        console.error('Error fetching user for recalculation:', error);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      usersToUpdate = [user];
    } else {
      return NextResponse.json({ error: 'Must provide userFid or set recalculateAll to true' }, { status: 400 });
    }

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const user of usersToUpdate) {
      try {
        // Calculate correct points from purchases (100x multiplier)
        const correctPurchasePoints = Math.floor(user.total_spent * 100.0);
        const checkInPoints = user.points_from_checkins || 0;
        const newTotalPoints = correctPurchasePoints + checkInPoints;

        // Update the user's points
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('user_leaderboard')
          .update({
            points_from_purchases: correctPurchasePoints,
            total_points: newTotalPoints
          })
          .eq('user_fid', user.user_fid)
          .select()
          .single();

        if (updateError) {
          console.error(`Error updating user ${user.user_fid}:`, updateError);
          errorCount++;
          results.push({
            user_fid: user.user_fid,
            success: false,
            error: updateError.message
          });
        } else {
          successCount++;
          results.push({
            user_fid: user.user_fid,
            success: true,
            old_total_points: user.points_from_purchases + checkInPoints,
            new_total_points: newTotalPoints,
            points_from_purchases: correctPurchasePoints,
            total_spent: user.total_spent
          });

          // Log the recalculation
          await supabaseAdmin
            .from('point_transactions')
            .insert({
              user_fid: user.user_fid,
              transaction_type: 'adjustment',
              points_earned: newTotalPoints - (user.points_from_purchases + checkInPoints),
              points_before: user.points_from_purchases + checkInPoints,
              points_after: newTotalPoints,
              description: 'Admin points recalculation (100x multiplier)',
              reference_id: 'admin_recalculation',
              metadata: {
                admin_action: true,
                old_purchase_points: user.points_from_purchases,
                new_purchase_points: correctPurchasePoints,
                multiplier: 100.0,
                total_spent: user.total_spent,
                recalculation_timestamp: new Date().toISOString()
              }
            });
        }
      } catch (userError) {
        console.error(`Unexpected error for user ${user.user_fid}:`, userError);
        errorCount++;
        results.push({
          user_fid: user.user_fid,
          success: false,
          error: userError.message
        });
      }
    }

    console.log(`✅ Points recalculation complete: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: `Recalculated points for ${successCount} users`,
      summary: {
        usersProcessed: usersToUpdate.length,
        successCount,
        errorCount
      },
      results: results
    });

  } catch (error) {
    console.error('Error in points recalculation:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate points' },
      { status: 500 }
    );
  }
});
