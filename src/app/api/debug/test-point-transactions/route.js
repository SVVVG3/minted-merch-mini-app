// Debug endpoint to test point transaction logging and retrieval

import { 
  getUserPointTransactions, 
  getUserPointTransactionStats,
  logPointTransaction,
  getUserLeaderboardData
} from '../../../../lib/points.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const userFid = url.searchParams.get('userFid');
    const action = url.searchParams.get('action') || 'transactions';
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const transactionType = url.searchParams.get('type') || null;
    
    if (!userFid) {
      return Response.json({
        success: false,
        error: 'Missing userFid parameter'
      }, { status: 400 });
    }

    const fid = parseInt(userFid);
    if (isNaN(fid) || fid <= 0) {
      return Response.json({
        success: false,
        error: 'Invalid userFid parameter'
      }, { status: 400 });
    }

    if (action === 'stats') {
      // Get transaction statistics
      const stats = await getUserPointTransactionStats(fid);
      const userData = await getUserLeaderboardData(fid);
      
      return Response.json({
        success: true,
        userFid: fid,
        currentData: userData,
        transactionStats: stats
      });
    } else {
      // Get transaction history
      const transactions = await getUserPointTransactions(fid, limit, transactionType);
      
      return Response.json({
        success: true,
        userFid: fid,
        transactions: transactions,
        count: transactions.length,
        filters: {
          limit: limit,
          type: transactionType
        }
      });
    }

  } catch (error) {
    console.error('Error in test-point-transactions GET:', error);
    return Response.json({
      success: false,
      error: 'Unexpected error fetching point transactions'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userFid, transactionType, pointsEarned, description, referenceId, metadata } = body;
    
    if (!userFid || !transactionType || pointsEarned === undefined) {
      return Response.json({
        success: false,
        error: 'Missing required fields: userFid, transactionType, pointsEarned'
      }, { status: 400 });
    }

    // Get current user data for before/after points
    const userData = await getUserLeaderboardData(userFid);
    if (!userData) {
      return Response.json({
        success: false,
        error: 'User not found in leaderboard'
      }, { status: 404 });
    }

    const pointsBefore = userData.total_points;
    const pointsAfter = pointsBefore + pointsEarned;

    // Log the test transaction
    const result = await logPointTransaction({
      userFid: userFid,
      transactionType: transactionType,
      pointsEarned: pointsEarned,
      pointsBefore: pointsBefore,
      pointsAfter: pointsAfter,
      description: description || `Test ${transactionType} transaction`,
      referenceId: referenceId || `test-${Date.now()}`,
      metadata: metadata || { testTransaction: true }
    });

    return Response.json({
      success: true,
      message: 'Test transaction logged successfully',
      transaction: result.transaction,
      pointsBefore: pointsBefore,
      pointsAfter: pointsAfter
    });

  } catch (error) {
    console.error('Error in test-point-transactions POST:', error);
    return Response.json({
      success: false,
      error: 'Unexpected error logging test transaction'
    }, { status: 500 });
  }
} 