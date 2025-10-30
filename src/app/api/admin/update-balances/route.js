import { NextResponse } from 'next/server';
import { getChatMembers } from '@/lib/chatMemberDatabase';
import { batchCheckEligibility } from '@/lib/chatEligibility';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    console.log('🔄 Starting manual chat member balance update...');
    const startTime = Date.now();

    // Get all active chat members
    const chatMembers = await getChatMembers();
    
    if (!chatMembers || chatMembers.length === 0) {
      console.log('ℹ️ No active chat members found');
      return NextResponse.json({
        success: true,
        message: 'No active chat members to update',
        stats: {
          totalMembers: 0,
          successCount: 0,
          errorCount: 0,
          eligibleCount: 0,
          ineligibleCount: 0,
          duration: Date.now() - startTime
        }
      });
    }

    console.log(`🔄 Updating token balances for ${chatMembers.length} chat members...`);

    // Run batch eligibility check (this will update balances in database)
    const results = await batchCheckEligibility(chatMembers);
    
    // Calculate statistics
    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.filter(r => r.error).length;
    const eligibleCount = results.filter(r => r.eligible).length;
    const ineligibleCount = results.filter(r => !r.eligible && !r.error).length;
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Manual balance update completed in ${duration}ms`);
    console.log(`📊 Results: ${successCount} success, ${errorCount} errors, ${eligibleCount} eligible, ${ineligibleCount} ineligible`);

    return NextResponse.json({
      success: true,
      message: 'Manual balance update completed',
      stats: {
        totalMembers: chatMembers.length,
        successCount,
        errorCount,
        eligibleCount,
        ineligibleCount,
        duration
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in manual balance update:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});
