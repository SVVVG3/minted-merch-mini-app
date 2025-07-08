// Debug endpoint for testing points system
import { 
  performDailyCheckin, 
  canCheckInToday, 
  getUserLeaderboardData, 
  addPurchasePoints,
  getLeaderboard,
  getUserLeaderboardPosition
} from '../../../../lib/points.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const testFid = parseInt(url.searchParams.get('testFid')) || 12345;
    const action = url.searchParams.get('action') || 'check-status';

    let result = {};

    switch (action) {
      case 'check-status':
        const canCheckin = await canCheckInToday(testFid);
        const userData = await getUserLeaderboardData(testFid);
        result = {
          testFid: testFid,
          canCheckInToday: canCheckin,
          userData: userData
        };
        break;

      case 'checkin':
        const checkinResult = await performDailyCheckin(testFid);
        result = {
          testFid: testFid,
          checkinResult: checkinResult
        };
        break;

      case 'purchase-points':
        const orderTotal = parseFloat(url.searchParams.get('orderTotal')) || 50;
        const orderId = url.searchParams.get('orderId') || 'TEST-ORDER-123';
        const purchaseResult = await addPurchasePoints(testFid, orderTotal, orderId);
        result = {
          testFid: testFid,
          orderTotal: orderTotal,
          orderId: orderId,
          purchaseResult: purchaseResult
        };
        break;

      case 'leaderboard':
        const limit = parseInt(url.searchParams.get('limit')) || 10;
        const leaderboard = await getLeaderboard(limit);
        const userPosition = await getUserLeaderboardPosition(testFid);
        result = {
          testFid: testFid,
          leaderboard: leaderboard,
          userPosition: userPosition
        };
        break;

      case 'full-test':
        // Run a comprehensive test
        const status = await canCheckInToday(testFid);
        const checkin = await performDailyCheckin(testFid);
        const purchase = await addPurchasePoints(testFid, 25, 'TEST-ORDER-456');
        const board = await getLeaderboard(5);
        const position = await getUserLeaderboardPosition(testFid);
        
        result = {
          testFid: testFid,
          initialStatus: status,
          checkinResult: checkin,
          purchaseResult: purchase,
          leaderboard: board,
          userPosition: position
        };
        break;

      default:
        return Response.json({
          success: false,
          error: 'Invalid action. Available: check-status, checkin, purchase-points, leaderboard, full-test'
        }, { status: 400 });
    }

    return Response.json({
      success: true,
      action: action,
      timestamp: new Date().toISOString(),
      data: result
    }, { status: 200 });

  } catch (error) {
    console.error('Error in points test API:', error);
    return Response.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
} 