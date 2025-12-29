// API endpoint for leaderboard data
import { getLeaderboard, getUserLeaderboardPosition } from '../../../../lib/points.js';
import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { setUserContext } from '@/lib/auth';

// Handle Mojo score leaderboard separately (queries profiles table)
async function handleMojoLeaderboard(userFid, limit) {
  try {
    console.log('📊 Fetching MMM (Mojo) leaderboard');
    
    // Fetch profiles with mojo scores, sorted by mojo_score descending
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, pfp_url, mojo_score, neynar_score, quotient_score, token_balance, staked_balance')
      .not('mojo_score', 'is', null)
      .gt('mojo_score', 0)
      .order('mojo_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching mojo leaderboard:', error);
      return Response.json({
        success: false,
        error: 'Failed to fetch leaderboard'
      }, { status: 500 });
    }

    // Transform data to match expected leaderboard format
    const leaderboard = profiles.map((profile, index) => ({
      user_fid: profile.fid,
      username: profile.username,
      display_name: profile.display_name,
      pfp_url: profile.pfp_url,
      mojo_score: profile.mojo_score,
      neynar_score: profile.neynar_score,
      quotient_score: profile.quotient_score,
      token_balance: profile.token_balance,
      staked_balance: profile.staked_balance,
      rank: index + 1,
    }));

    // Get user position if userFid provided
    let userPosition = null;
    if (userFid) {
      const fid = parseInt(userFid);
      if (!isNaN(fid) && fid > 0) {
        // Check if user is in the displayed leaderboard
        const userInLeaderboard = leaderboard.find(user => user.user_fid === fid);
        
        if (userInLeaderboard) {
          userPosition = {
            ...userInLeaderboard,
            position: userInLeaderboard.rank,
          };
        } else {
          // User not in top results - fetch their data directly
          const { data: userData, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('fid, username, display_name, pfp_url, mojo_score, neynar_score, quotient_score, token_balance, staked_balance')
            .eq('fid', fid)
            .single();

          if (!userError && userData && userData.mojo_score) {
            // Count how many users have higher mojo scores
            const { count, error: countError } = await supabaseAdmin
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .gt('mojo_score', userData.mojo_score);

            const position = countError ? null : (count || 0) + 1;
            
            userPosition = {
              user_fid: userData.fid,
              username: userData.username,
              display_name: userData.display_name,
              pfp_url: userData.pfp_url,
              mojo_score: userData.mojo_score,
              neynar_score: userData.neynar_score,
              quotient_score: userData.quotient_score,
              token_balance: userData.token_balance,
              staked_balance: userData.staked_balance,
              position: position,
            };
          }
        }
      }
    }

    console.log(`✅ Fetched ${leaderboard.length} users for MMM leaderboard`);

    return Response.json({
      success: true,
      data: {
        leaderboard: leaderboard,
        userPosition: userPosition,
        category: 'mojo',
        limit: limit
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in mojo leaderboard:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('userFid');
    const limit = parseInt(searchParams.get('limit')) || 10;
    const category = searchParams.get('category') || 'points';

    console.log('Getting leaderboard for userFid:', userFid, 'limit:', limit);

    // 🔒 SECURITY: Set user context for RLS policies
    if (userFid) {
      await setUserContext(userFid);
    }

    // Validate limit
    // Increased limit for accurate leaderboard rankings with token multipliers
    if (limit < 1 || limit > 50000) {
      return Response.json({
        success: false,
        error: 'Limit must be between 1 and 50000'
      }, { status: 400 });
    }

    // Validate category
    const validCategories = ['points', 'streaks', 'purchases', 'spending', 'mojo'];
    if (!validCategories.includes(category)) {
      return Response.json({
        success: false,
        error: 'Invalid category. Must be: points, streaks, purchases, spending, or mojo'
      }, { status: 400 });
    }
    
    // Handle Mojo category with direct profiles query
    if (category === 'mojo') {
      return await handleMojoLeaderboard(userFid, limit);
    }

    // Get leaderboard data
    const leaderboard = await getLeaderboard(limit, category);

    // Get user position if userFid provided
    let userPosition = null;
    if (userFid) {
      const fid = parseInt(userFid);
      if (!isNaN(fid) && fid > 0) {
        console.log(`🚨 API CALL: Getting user data and position for FID ${fid} in category ${category}`);
        
        // Get user's data (fast - just their row)
        const userData = await getUserLeaderboardPosition(fid, category);
        
        // Check if user is in the displayed leaderboard
        const userInLeaderboard = leaderboard.find(user => user.user_fid === fid);
        
        if (userInLeaderboard) {
          // User is in top results - use their rank from the leaderboard
          const position = userInLeaderboard.rank;
          userPosition = {
            ...userData,
            position: position
          };
          console.log(`✅ User found in top ${limit}: position ${position}`);
        } else {
          // User not in top results - need to calculate position
          // For accurate position with multipliers, we need to fetch more users
          // Fetch a larger leaderboard to find their position
          console.log(`📊 User not in top ${limit}, fetching larger leaderboard to find position...`);
          const fullLeaderboard = await getLeaderboard(10000, category);
          const userInFullLeaderboard = fullLeaderboard.find(user => user.user_fid === fid);
          
          if (userInFullLeaderboard) {
            const position = userInFullLeaderboard.rank;
            userPosition = {
              ...userData,
              position: position
            };
            console.log(`✅ User found in extended leaderboard: position ${position}`);
          } else {
            // User not found even in extended leaderboard - return data without position
            userPosition = {
              ...userData,
              position: null
            };
            console.log(`ℹ️ User not found in top 10,000, position unknown`);
          }
        }
        
        console.log(`🚨 API RESULT: User position result:`, userPosition);
      }
    }

    return Response.json({
      success: true,
      data: {
        leaderboard: leaderboard,
        userPosition: userPosition,
        category: category,
        limit: limit
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 