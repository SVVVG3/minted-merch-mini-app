import { NextResponse } from 'next/server';
import { batchCheckEligibility, getEligibilitySummary } from '@/lib/chatEligibility';

// This would need to be secured with admin authentication in production
export async function GET(request) {
  try {
    // TODO: Add admin authentication check here
    // const isAdmin = await verifyAdminAuth(request);
    // if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // For now, return mock data structure - you'd replace this with your actual chat member data
    const mockChatMembers = [
      {
        fid: 466111,
        username: '_svvvg3',
        displayName: 'SVVVG3',
        walletAddresses: [
          '0x44d4c58efcbb44639d64420175cf519aa3191a86',
          '0x380d89b06a1a596a2c4f788daaabc2dcc6493888'
        ]
      }
      // Add more members from your chat database
    ];

    return NextResponse.json({
      success: true,
      members: mockChatMembers,
      count: mockChatMembers.length
    });

  } catch (error) {
    console.error('❌ Admin chat members API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // TODO: Add admin authentication check here
    
    const { action, members } = await request.json();

    if (action === 'batch_check') {
      if (!members || !Array.isArray(members)) {
        return NextResponse.json({
          success: false,
          error: 'Members array is required for batch check'
        }, { status: 400 });
      }

      console.log('🔍 Running batch eligibility check for', members.length, 'members');
      
      // Run batch eligibility check
      const results = await batchCheckEligibility(members);
      
      // Generate summary statistics
      const summary = getEligibilitySummary(results);
      
      return NextResponse.json({
        success: true,
        results,
        summary,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Admin batch check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
