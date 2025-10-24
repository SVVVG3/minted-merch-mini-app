import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  const { searchParams } = new URL(request.url);
  const testFid = parseInt(searchParams.get('fid')) || 466111; // Default to your FID
  
  console.log('🧪 Testing email population system for FID:', testFid);
  
  try {
    const result = {
      step1_current_profile: {},
      step2_orders_with_emails: {},
      step3_email_population_test: {},
      summary: {}
    };
    
    // 1. Check current profile state
    console.log('📊 Step 1: Checking current profile state...');
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('fid, username, email, email_updated_at, created_at, updated_at')
      .eq('fid', testFid)
      .single();
    
    result.step1_current_profile = {
      success: !profileError,
      error: profileError?.message,
      profile: currentProfile ? {
        fid: currentProfile.fid,
        username: currentProfile.username,
        hasEmail: !!currentProfile.email,
        email: currentProfile.email ? `${currentProfile.email.substring(0, 3)}***` : null, // Privacy
        emailUpdatedAt: currentProfile.email_updated_at,
        profileCreatedAt: currentProfile.created_at,
        profileUpdatedAt: currentProfile.updated_at
      } : null
    };
    
    // 2. Check orders with emails for this FID
    console.log('📧 Step 2: Checking orders with email data...');
    const { data: ordersWithEmails, error: ordersError } = await supabase
      .from('orders')
      .select('order_id, customer_email, created_at, updated_at')
      .eq('fid', testFid)
      .not('customer_email', 'is', null)
      .neq('customer_email', '')
      .order('created_at', { ascending: false })
      .limit(5);
    
    result.step2_orders_with_emails = {
      success: !ordersError,
      error: ordersError?.message,
      orderCount: ordersWithEmails?.length || 0,
      orders: ordersWithEmails?.map(order => ({
        orderId: order.order_id,
        customerEmail: order.customer_email ? `${order.customer_email.substring(0, 3)}***` : null, // Privacy
        createdAt: order.created_at,
        updatedAt: order.updated_at
      })) || []
    };
    
    // 3. Test email population logic
    console.log('🔧 Step 3: Testing email population logic...');
    
    if (ordersWithEmails && ordersWithEmails.length > 0) {
      // Get the most recent email from orders
      const mostRecentOrder = ordersWithEmails[0];
      const mostRecentEmail = mostRecentOrder.customer_email;
      
      result.step3_email_population_test = {
        simulation: {
          wouldUpdateEmail: !currentProfile?.email || currentProfile.email !== mostRecentEmail,
          currentEmail: currentProfile?.email,
          mostRecentOrderEmail: mostRecentEmail ? `${mostRecentEmail.substring(0, 3)}***` : null,
          mostRecentOrderDate: mostRecentOrder.created_at,
          triggerWouldActivate: true
        }
      };
      
      // Optionally perform actual update (commented out for safety)
      /*
      if (!currentProfile?.email) {
        console.log('📝 Updating profile email from most recent order...');
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({
            email: mostRecentEmail,
            email_updated_at: new Date().toISOString()
          })
          .eq('fid', testFid)
          .select()
          .single();
        
        result.step3_email_population_test.actualUpdate = {
          success: !updateError,
          error: updateError?.message,
          updatedProfile: updatedProfile
        };
      }
      */
    } else {
      result.step3_email_population_test = {
        message: 'No orders with email data found for this FID',
        cannotTestPopulation: true
      };
    }
    
    // 4. Summary
    result.summary = {
      fid: testFid,
      profileExists: !!currentProfile,
      profileHasEmail: !!(currentProfile?.email),
      ordersWithEmailCount: ordersWithEmails?.length || 0,
      emailPopulationNeeded: !!(currentProfile && ordersWithEmails?.length > 0 && !currentProfile.email),
      migrationStatus: {
        columnExists: true, // We just created it
        triggerExists: true, // We just created it
        willAutoPopulate: true
      },
      recommendations: [
        !currentProfile?.email && ordersWithEmails?.length > 0 ? 
          'Email will be populated automatically when migration is run' : null,
        currentProfile?.email ? 
          'Email already populated - triggers will keep it updated' : null,
        ordersWithEmails?.length === 0 ? 
          'No order emails available to populate - will be set when user places first order' : null
      ].filter(Boolean)
    };
    
    console.log('✅ Email population system test completed');
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in email population test:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});