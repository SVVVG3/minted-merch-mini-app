import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkTokenGatedEligibility, createExampleTokenGatedDiscounts } from '@/lib/tokenGating';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const testFid = parseInt(searchParams.get('fid')) || 466111; // Default to your FID
  const action = searchParams.get('action') || 'test_eligibility';
  
  console.log('🧪 Testing Bankr Club token gating for FID:', testFid, 'Action:', action);
  
  try {
    const result = {
      action,
      fid: testFid,
      timestamp: new Date().toISOString(),
      step1_profile_check: {},
      step2_discount_creation: {},
      step3_eligibility_check: {},
      step4_auto_apply_test: {},
      summary: {}
    };
    
    // Step 1: Check current profile Bankr Club status
    console.log('📊 Step 1: Checking current profile Bankr Club status...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('fid, username, bankr_club_member, x_username, bankr_membership_updated_at')
      .eq('fid', testFid)
      .single();
    
    if (profileError) {
      result.step1_profile_check = { error: profileError.message, found: false };
    } else {
      result.step1_profile_check = {
        found: true,
        profile: {
          fid: profile.fid,
          username: profile.username,
          bankr_club_member: profile.bankr_club_member,
          x_username: profile.x_username,
          membership_updated_at: profile.bankr_membership_updated_at,
          membership_age_days: profile.bankr_membership_updated_at ? 
            Math.floor((new Date() - new Date(profile.bankr_membership_updated_at)) / (24 * 60 * 60 * 1000)) : null
        }
      };
    }
    
    // Step 2: Create or find Bankr Club discount
    console.log('🎯 Step 2: Creating/finding Bankr Club discount...');
    
    if (action === 'create_test_discount' || action === 'full_test') {
      // Create a test Bankr Club discount
      const testDiscountData = {
        fid: null, // Shared discount
        code: 'BANKRCLUB-TEST-' + Date.now(),
        discount_type: 'percentage',
        discount_value: 15,
        discount_scope: 'site_wide',
        gating_type: 'bankr_club',
        auto_apply: true,
        priority_level: 12,
        is_shared_code: true,
        discount_description: 'Test 15% off for Bankr Club members',
        campaign_id: 'bankr_club_test_2025',
        code_type: 'promotional',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };
      
      const { data: newDiscount, error: discountError } = await supabase
        .from('discount_codes')
        .insert(testDiscountData)
        .select()
        .single();
      
      if (discountError) {
        result.step2_discount_creation = { error: discountError.message, created: false };
      } else {
        result.step2_discount_creation = {
          created: true,
          discount: {
            id: newDiscount.id,
            code: newDiscount.code,
            discount_value: newDiscount.discount_value,
            gating_type: newDiscount.gating_type,
            auto_apply: newDiscount.auto_apply
          }
        };
      }
    } else {
      // Find existing Bankr Club discounts
      const { data: bankrDiscounts, error: findError } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('gating_type', 'bankr_club')
        .limit(5);
      
      if (findError) {
        result.step2_discount_creation = { error: findError.message, found: false };
      } else {
        result.step2_discount_creation = {
          found: true,
          count: bankrDiscounts.length,
          discounts: bankrDiscounts.map(d => ({
            id: d.id,
            code: d.code,
            discount_value: d.discount_value,
            gating_type: d.gating_type,
            auto_apply: d.auto_apply,
            created_at: d.created_at
          }))
        };
      }
    }
    
    // Step 3: Test eligibility checking
    console.log('🔍 Step 3: Testing eligibility checking...');
    
    const testDiscount = result.step2_discount_creation.created ? 
      result.step2_discount_creation.discount : 
      (result.step2_discount_creation.discounts && result.step2_discount_creation.discounts[0]);
    
    if (testDiscount) {
      try {
        // Get full discount record for eligibility check
        const { data: fullDiscount, error: fullDiscountError } = await supabase
          .from('discount_codes')
          .select('*')
          .eq('id', testDiscount.id)
          .single();
        
        if (fullDiscountError) {
          result.step3_eligibility_check = { error: fullDiscountError.message };
        } else {
          // Test eligibility
          const eligibilityResult = await checkTokenGatedEligibility(
            fullDiscount, 
            testFid, 
            [], // No wallet addresses needed for Bankr Club
            { userAgent: 'Debug Test', ipAddress: '127.0.0.1' }
          );
          
          result.step3_eligibility_check = {
            success: true,
            discount_tested: {
              code: fullDiscount.code,
              gating_type: fullDiscount.gating_type
            },
            eligibility_result: eligibilityResult
          };
        }
      } catch (eligibilityError) {
        result.step3_eligibility_check = { 
          error: eligibilityError.message,
          stack: eligibilityError.stack 
        };
      }
    } else {
      result.step3_eligibility_check = { error: 'No discount available for testing' };
    }
    
    // Step 4: Test auto-apply functionality
    console.log('🎪 Step 4: Testing auto-apply functionality...');
    
    if (action === 'test_auto_apply' || action === 'full_test') {
      try {
        // Import the getEligibleAutoApplyDiscounts function
        const { getEligibleAutoApplyDiscounts } = await import('@/lib/tokenGating');
        
        const autoApplyResult = await getEligibleAutoApplyDiscounts(
          testFid, 
          [], // No wallet addresses needed for Bankr Club
          'site_wide'
        );
        
        result.step4_auto_apply_test = {
          success: true,
          eligible_discounts_count: autoApplyResult.length,
          eligible_discounts: autoApplyResult.map(d => ({
            code: d.code,
            discount_value: d.discount_value,
            gating_type: d.gating_type,
            eligibility_reason: d.eligibility_details?.reason
          }))
        };
      } catch (autoApplyError) {
        result.step4_auto_apply_test = { 
          error: autoApplyError.message,
          stack: autoApplyError.stack 
        };
      }
    } else {
      result.step4_auto_apply_test = { skipped: 'Use action=test_auto_apply or action=full_test' };
    }
    
    // Summary
    const profileFound = result.step1_profile_check.found;
    const isBankrMember = result.step1_profile_check.profile?.bankr_club_member;
    const eligibilityPassed = result.step3_eligibility_check.eligibility_result?.eligible;
    const autoApplyFound = result.step4_auto_apply_test.eligible_discounts_count > 0;
    
    result.summary = {
      profile_found: profileFound,
      is_bankr_member: isBankrMember,
      eligibility_check_passed: eligibilityPassed,
      auto_apply_discounts_found: autoApplyFound,
      overall_status: profileFound && isBankrMember && eligibilityPassed ? 'SUCCESS' : 'FAILED',
      recommendation: !profileFound ? 'User profile not found' :
                     !isBankrMember ? 'User is not a Bankr Club member' :
                     !eligibilityPassed ? 'Eligibility check failed' :
                     'Bankr Club gating is working correctly!'
    };
    
    console.log('✅ Bankr Club gating test completed:', result.summary);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Error in Bankr Club gating test:', error);
    return NextResponse.json({ 
      error: error.message, 
      action,
      fid: testFid,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Helper function to create example discounts
export async function POST(request) {
  try {
    console.log('🛠️ Creating example token-gated discounts including Bankr Club...');
    
    const result = await createExampleTokenGatedDiscounts();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Example discounts created successfully',
      result 
    });
    
  } catch (error) {
    console.error('❌ Error creating example discounts:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
} 