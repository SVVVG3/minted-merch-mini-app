// Debug endpoint to sync existing order data with purchase tracking columns

import { syncPurchaseTracking } from '../../../../lib/points.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const userFid = url.searchParams.get('userFid');
    
    if (userFid) {
      const fid = parseInt(userFid);
      if (isNaN(fid) || fid <= 0) {
        return Response.json({
          success: false,
          error: 'Invalid userFid parameter'
        }, { status: 400 });
      }
      
      const result = await syncPurchaseTracking(fid);
      
      return Response.json({
        success: true,
        message: `Purchase tracking sync completed for user ${fid}`,
        result
      }, { status: 200 });
    }
    
    return Response.json({
      success: true,
      message: 'Purchase tracking sync debug endpoint',
      usage: {
        'GET': 'Show this info',
        'GET?userFid=123': 'Sync purchase tracking for specific user',
        'POST': 'Sync purchase tracking for all users'
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error in purchase tracking sync GET:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const result = await syncPurchaseTracking();
    
    return Response.json({
      success: true,
      message: 'Purchase tracking sync completed for all users',
      result
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error in purchase tracking sync POST:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 