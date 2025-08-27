import { NextResponse } from 'next/server';
import { batchCheckEligibility, getEligibilitySummary } from '@/lib/chatEligibility';
import { getChatMembers, addChatMembersByFids, removeChatMember } from '@/lib/chatMemberDatabase';

// This would need to be secured with admin authentication in production
export async function GET(request) {
  try {
    // TODO: Add admin authentication check here
    // const isAdmin = await verifyAdminAuth(request);
    // if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get chat members from database
    const members = await getChatMembers();

    return NextResponse.json({
      success: true,
      members,
      count: members.length
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
    
    const { action, members, fids, fid } = await request.json();

    switch (action) {
      case 'batch_check':
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

      case 'add_members':
        if (!fids || !Array.isArray(fids)) {
          return NextResponse.json({
            success: false,
            error: 'FIDs array is required for adding members'
          }, { status: 400 });
        }

        const addResult = await addChatMembersByFids(fids);
        return NextResponse.json(addResult);

      case 'remove_member':
        if (!fid) {
          return NextResponse.json({
            success: false,
            error: 'FID is required for removing member'
          }, { status: 400 });
        }

        console.log('🗑️ Removing chat member with FID:', fid);
        const removeResult = await removeChatMember(fid);
        return NextResponse.json(removeResult);

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: batch_check, add_members, or remove_member'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Admin batch check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
