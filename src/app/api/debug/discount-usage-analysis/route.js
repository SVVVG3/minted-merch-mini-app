import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('=== DISCOUNT USAGE TRACKING ANALYSIS ===');
    
    const analysis = {
      timestamp: new Date().toISOString(),
      system_health: {
        triggers_active: true,
        tracking_status: 'operational'
      },
      discount_codes: [],
      usage_analysis: {},
      data_integrity: {},
      recommendations: []
    };

    // 1. Check all discount codes with usage tracking
    const { data: discountCodes, error: codesError } = await supabase
      .from('discount_codes')
      .select(`
        id, code, discount_type, discount_value, 
        is_shared_code, max_uses_total, max_uses_per_user, 
        current_total_uses, created_at
      `)
      .or('is_shared_code.eq.true,max_uses_total.not.is.null')
      .order('created_at', { ascending: false });

    if (codesError) {
      throw new Error(`Failed to fetch discount codes: ${codesError.message}`);
    }

    // 2. Get usage data for each discount code
    for (const code of discountCodes) {
      const { data: usageRecords, error: usageError } = await supabase
        .from('discount_code_usage')
        .select('id, discount_code_name, fid, order_id, discount_amount, used_at')
        .eq('discount_code_id', code.id);

      if (usageError) {
        console.error(`Error fetching usage for ${code.code}:`, usageError);
        continue;
      }

      const actualUsageCount = usageRecords?.length || 0;
      const discrepancy = code.current_total_uses - actualUsageCount;
      const utilizationRate = code.max_uses_total ? 
        ((actualUsageCount / code.max_uses_total) * 100).toFixed(1) : null;

      // Check data integrity
      const missingCodeNames = usageRecords?.filter(r => !r.discount_code_name).length || 0;
      const hasIntegrityIssues = discrepancy !== 0 || missingCodeNames > 0;

      const codeAnalysis = {
        code: code.code,
        type: code.is_shared_code ? 'shared' : 'user-specific',
        limits: {
          max_total: code.max_uses_total,
          max_per_user: code.max_uses_per_user
        },
        usage: {
          recorded_count: code.current_total_uses,
          actual_count: actualUsageCount,
          discrepancy: discrepancy,
          utilization_rate: utilizationRate + '%',
          recent_usage: usageRecords?.slice(0, 3).map(r => ({
            fid: r.fid,
            order_id: r.order_id,
            amount: r.discount_amount,
            date: r.used_at
          })) || []
        },
        integrity: {
          is_healthy: !hasIntegrityIssues,
          missing_code_names: missingCodeNames,
          counter_synced: discrepancy === 0
        }
      };

      analysis.discount_codes.push(codeAnalysis);

      // Track overall statistics
      if (!analysis.usage_analysis.total_codes) {
        analysis.usage_analysis = {
          total_codes: 0,
          shared_codes: 0,
          user_specific_codes: 0,
          total_usage_records: 0,
          codes_with_discrepancies: 0
        };
      }

      analysis.usage_analysis.total_codes++;
      if (code.is_shared_code) analysis.usage_analysis.shared_codes++;
      else analysis.usage_analysis.user_specific_codes++;
      analysis.usage_analysis.total_usage_records += actualUsageCount;
      if (discrepancy !== 0) analysis.usage_analysis.codes_with_discrepancies++;
    }

    // 3. Check database triggers and functions
    const { data: triggers, error: triggerError } = await supabase
      .rpc('sql', { 
        query: `
          SELECT trigger_name, event_manipulation, action_statement 
          FROM information_schema.triggers 
          WHERE event_object_table = 'discount_code_usage'
          AND trigger_name = 'trigger_update_discount_usage_counter';
        `
      });

    analysis.system_health.triggers_active = !triggerError && triggers?.length > 0;

    // 4. Data integrity summary
    const totalDiscrepancies = analysis.discount_codes
      .reduce((sum, code) => sum + Math.abs(code.usage.discrepancy), 0);
    
    const totalMissingNames = analysis.discount_codes
      .reduce((sum, code) => sum + code.integrity.missing_code_names, 0);

    analysis.data_integrity = {
      overall_health: totalDiscrepancies === 0 && totalMissingNames === 0 ? 'excellent' : 'needs_attention',
      total_discrepancies: totalDiscrepancies,
      total_missing_code_names: totalMissingNames,
      healthy_codes: analysis.discount_codes.filter(c => c.integrity.is_healthy).length,
      unhealthy_codes: analysis.discount_codes.filter(c => !c.integrity.is_healthy).length
    };

    // 5. Generate recommendations
    if (totalDiscrepancies > 0) {
      analysis.recommendations.push({
        issue: 'Counter Discrepancies',
        description: `${analysis.usage_analysis.codes_with_discrepancies} discount codes have counter discrepancies`,
        action: 'Run sync_discount_usage_counters() function to fix',
        priority: 'high'
      });
    }

    if (totalMissingNames > 0) {
      analysis.recommendations.push({
        issue: 'Missing Code Names',
        description: `${totalMissingNames} usage records missing discount_code_name`,
        action: 'Run populate_missing_discount_code_names() function',
        priority: 'medium'
      });
    }

    if (!analysis.system_health.triggers_active) {
      analysis.recommendations.push({
        issue: 'Database Trigger Missing',
        description: 'Automatic usage counter trigger is not active',
        action: 'Re-apply the trigger_update_discount_usage_counter migration',
        priority: 'critical'
      });
    }

    if (analysis.recommendations.length === 0) {
      analysis.recommendations.push({
        issue: 'None',
        description: 'All discount usage tracking systems are functioning correctly',
        action: 'No action required',
        priority: 'info'
      });
    }

    console.log('=== ANALYSIS COMPLETE ===');
    console.log(`Analyzed ${analysis.usage_analysis.total_codes} discount codes`);
    console.log(`Total usage records: ${analysis.usage_analysis.total_usage_records}`);
    console.log(`Data integrity: ${analysis.data_integrity.overall_health}`);

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Error in discount usage analysis:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 