import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    console.log('🧹 Starting cleanup of duplicate welcome discount codes...');
    
    const results = {
      timestamp: new Date().toISOString(),
      usersProcessed: 0,
      codesRemoved: 0,
      codesKept: 0,
      errors: []
    };

    // Get all welcome discount codes grouped by FID
    const { data: allWelcomeCodes, error: fetchError } = await supabaseAdmin
      .from('discount_codes')
      .select('id, fid, code, created_at, is_used')
      .eq('code_type', 'welcome')
      .order('fid', { ascending: true })
      .order('created_at', { ascending: true }); // Oldest first

    if (fetchError) {
      console.error('Error fetching welcome codes:', fetchError);
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    console.log(`Found ${allWelcomeCodes.length} total welcome discount codes`);

    // Group codes by FID
    const codesByFid = allWelcomeCodes.reduce((acc, code) => {
      if (!acc[code.fid]) {
        acc[code.fid] = [];
      }
      acc[code.fid].push(code);
      return acc;
    }, {});

    console.log(`Found codes for ${Object.keys(codesByFid).length} unique users`);

    // Process each user's codes
    for (const [fid, codes] of Object.entries(codesByFid)) {
      results.usersProcessed++;
      
      if (codes.length <= 1) {
        // User has only one code, no duplicates to remove
        results.codesKept += codes.length;
        continue;
      }

      console.log(`Processing FID ${fid}: found ${codes.length} welcome codes`);

      // Keep the oldest code (first in the array since we ordered by created_at ASC)
      const codeToKeep = codes[0];
      const codesToRemove = codes.slice(1);

      results.codesKept += 1;

      // Remove duplicate codes
      for (const codeToRemove of codesToRemove) {
        try {
          // Only remove unused codes to be safe
          if (!codeToRemove.is_used) {
            const { error: deleteError } = await supabaseAdmin
              .from('discount_codes')
              .delete()
              .eq('id', codeToRemove.id);

            if (deleteError) {
              console.error(`Error deleting code ${codeToRemove.code}:`, deleteError);
              results.errors.push(`Failed to delete ${codeToRemove.code}: ${deleteError.message}`);
            } else {
              console.log(`Deleted duplicate unused code: ${codeToRemove.code}`);
              results.codesRemoved++;
            }
          } else {
            console.log(`Skipping used code: ${codeToRemove.code}`);
            results.codesKept++;
          }
        } catch (error) {
          console.error(`Error processing code ${codeToRemove.code}:`, error);
          results.errors.push(`Error processing ${codeToRemove.code}: ${error.message}`);
        }
      }

      console.log(`FID ${fid}: Kept ${codeToKeep.code}, removed ${codesToRemove.filter(c => !c.is_used).length} duplicates`);
    }

    console.log('🧹 Cleanup completed:', results);

    return NextResponse.json({
      success: true,
      message: 'Duplicate welcome codes cleanup completed',
      results: results
    });

  } catch (error) {
    console.error('Error in cleanup script:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

export const GET = withAdminAuth(async (request, context) => {
  try {
    // Just analyze duplicates without removing them
    const { data: allWelcomeCodes, error: fetchError } = await supabaseAdmin
      .from('discount_codes')
      .select('id, fid, code, created_at, is_used')
      .eq('code_type', 'welcome')
      .order('fid', { ascending: true })
      .order('created_at', { ascending: true });

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    // Group codes by FID to find duplicates
    const codesByFid = allWelcomeCodes.reduce((acc, code) => {
      if (!acc[code.fid]) {
        acc[code.fid] = [];
      }
      acc[code.fid].push(code);
      return acc;
    }, {});

    const analysis = {
      totalCodes: allWelcomeCodes.length,
      uniqueUsers: Object.keys(codesByFid).length,
      usersWithDuplicates: 0,
      totalDuplicates: 0,
      duplicatesByUser: {}
    };

    for (const [fid, codes] of Object.entries(codesByFid)) {
      if (codes.length > 1) {
        analysis.usersWithDuplicates++;
        analysis.totalDuplicates += codes.length - 1; // Subtract 1 to count only duplicates
        analysis.duplicatesByUser[fid] = {
          totalCodes: codes.length,
          duplicates: codes.length - 1,
          codes: codes.map(c => ({
            code: c.code,
            created_at: c.created_at,
            is_used: c.is_used
          }))
        };
      }
    }

    return NextResponse.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('Error analyzing duplicates:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});