import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit')) || 100;
    // Cap the limit at 5000 for performance, but allow higher than 1000
    const limit = Math.min(requestedLimit, 5000);
    const sortBy = searchParams.get('sortBy') || 'total_points';
    
    console.log(`🌐 External API: Fetching leaderboard data - requested: ${requestedLimit}, using: ${limit}, sortBy: ${sortBy}`);

    // Get leaderboard data with wallet addresses
    // Note: Supabase has a hard 1000 row limit per query, so we need pagination for larger requests
    const SUPABASE_MAX_LIMIT = 1000;
    const needsPagination = limit > SUPABASE_MAX_LIMIT;
    
    let allData = [];
    let error = null;
    
    if (needsPagination) {
      console.log(`📄 Using pagination for limit ${limit} (fetching in chunks of ${SUPABASE_MAX_LIMIT})`);
      
      let offset = 0;
      let hasMore = true;
      
      while (hasMore && allData.length < limit) {
        const currentLimit = Math.min(SUPABASE_MAX_LIMIT, limit - allData.length);
        
        let query = supabaseAdmin
          .from('user_leaderboard')
          .select(`
            *,
            profiles!inner(
              primary_eth_address,
              bankr_evm_address,
              custody_address
            )
          `)
          .range(offset, offset + currentLimit - 1);

        // Sort based on requested field
        switch (sortBy) {
          case 'total_points':
            query = query.order('total_points', { ascending: false });
            break;
          case 'checkin_streak':
            query = query.order('checkin_streak', { ascending: false });
            break;
          case 'points_from_purchases':
            query = query.order('points_from_purchases', { ascending: false });
            break;
          case 'total_orders':
            query = query.order('total_orders', { ascending: false });
            break;
          default:
            query = query.order('total_points', { ascending: false });
        }

        const { data: chunkData, error: chunkError } = await query;
        
        if (chunkError) {
          error = chunkError;
          break;
        }
        
        if (!chunkData || chunkData.length === 0) {
          hasMore = false;
          break;
        }
        
        allData.push(...chunkData);
        offset += currentLimit;
        
        // If we got less than requested, we've reached the end
        if (chunkData.length < currentLimit) {
          hasMore = false;
        }
        
        console.log(`📄 Fetched chunk: ${chunkData.length} entries, total so far: ${allData.length}`);
      }
    } else {
      // Single query for smaller requests
      let query = supabaseAdmin
        .from('user_leaderboard')
        .select(`
          *,
          profiles!inner(
            primary_eth_address,
            bankr_evm_address,
            custody_address
          )
        `)
        .limit(limit);

      // Sort based on requested field
      switch (sortBy) {
        case 'total_points':
          query = query.order('total_points', { ascending: false });
          break;
        case 'checkin_streak':
          query = query.order('checkin_streak', { ascending: false });
          break;
        case 'points_from_purchases':
          query = query.order('points_from_purchases', { ascending: false });
          break;
        case 'total_orders':
          query = query.order('total_orders', { ascending: false });
          break;
        default:
          query = query.order('total_points', { ascending: false });
      }

      const { data, error: queryError } = await query;
      allData = data || [];
      error = queryError;
    }

    const leaderboardData = allData;

    if (error) {
      console.error('Error fetching external leaderboard:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leaderboard data' },
        { status: 500 }
      );
    }

    // Format data for external consumption with address and score fields
    const formattedData = leaderboardData
      .map((entry, index) => {
        // Get the best available wallet address (prioritize primary_eth_address, then bankr_evm_address, then custody_address)
        const walletAddress = entry.profiles?.primary_eth_address || 
                             entry.profiles?.bankr_evm_address || 
                             entry.profiles?.custody_address;
        
        // Only include users with wallet addresses
        if (!walletAddress) {
          return null;
        }
        
        return {
          address: walletAddress,
          score: entry.total_points,
          rank: index + 1,
          // Additional fields that might be useful
          fid: entry.user_fid,
          username: entry.username,
          streak: entry.checkin_streak,
          purchases: entry.total_orders,
          purchasePoints: entry.points_from_purchases
        };
      })
      .filter(entry => entry !== null) // Remove entries without wallet addresses
      .map((entry, index) => ({ ...entry, rank: index + 1 })); // Re-rank after filtering

    console.log(`✅ External API: Successfully formatted ${formattedData.length} leaderboard entries (requested: ${requestedLimit}, fetched: ${leaderboardData.length})`);

    return NextResponse.json({
      success: true,
      data: formattedData,
      total: formattedData.length,
      requested: requestedLimit,
      fetched: leaderboardData.length,
      sortedBy: sortBy,
      // Metadata for external apps
      metadata: {
        source: "Minted Merch Mini App",
        lastUpdated: new Date().toISOString(),
        description: "Leaderboard based on user points from daily check-ins and purchases"
      }
    });

  } catch (error) {
    console.error('Error in external leaderboard API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
