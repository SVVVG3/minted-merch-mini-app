import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '../../../../lib/supabase.js';

export async function GET(request) {
  try {
    console.log('🧪 Testing admin client functionality...');
    
    // Test regular client
    const { data: regularData, error: regularError } = await supabase
      .from('profiles')
      .select('fid, has_notifications', { count: 'exact' })
      .eq('has_notifications', true)
      .limit(5);
    
    // Test admin client
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('profiles')  
      .select('fid, has_notifications', { count: 'exact' })
      .eq('has_notifications', true)
      .limit(5);
    
    // Check if admin client exists
    const hasAdminClient = !!supabaseAdmin;
    const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    return NextResponse.json({
      success: true,
      message: 'Admin client test results',
      environment: {
        hasAdminClient,
        hasServiceRoleKey,
        nodeEnv: process.env.NODE_ENV,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING'
      },
      regularClient: {
        error: regularError?.message || null,
        dataCount: regularData?.length || 0,
        firstUser: regularData?.[0] || null
      },
      adminClient: {
        error: adminError?.message || null,
        dataCount: adminData?.length || 0,
        firstUser: adminData?.[0] || null
      },
      comparison: {
        sameResults: (regularData?.length || 0) === (adminData?.length || 0),
        regularWorking: !regularError && regularData,
        adminWorking: !adminError && adminData
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing admin client:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 