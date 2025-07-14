import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    console.log('🎫 Fetching all discount codes for admin dashboard...');

    // Fetch all discount codes with usage counts
    const { data: discounts, error: discountsError } = await supabaseAdmin
      .from('discount_codes')
      .select(`
        *,
        discount_code_usage (
          id,
          fid,
          used_at
        )
      `)
      .order('created_at', { ascending: false });

    if (discountsError) {
      console.error('Error fetching discounts:', discountsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch discounts'
      }, { status: 500 });
    }

    // Format discounts with usage statistics
    const formattedDiscounts = discounts.map(discount => {
      const usageCount = discount.discount_code_usage?.length || 0;
      const isExpired = discount.expires_at && new Date(discount.expires_at) < new Date();
      const isActive = !isExpired && !discount.is_used && usageCount < (discount.max_uses_total || Infinity);

      return {
        id: discount.id,
        code: discount.code,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        code_type: discount.code_type,
        gating_type: discount.gating_type,
        
        // Usage stats
        usage_count: usageCount,
        max_uses_total: discount.max_uses_total,
        max_uses_per_user: discount.max_uses_per_user,
        current_total_uses: discount.current_total_uses,
        
        // Status
        is_active: isActive,
        is_expired: isExpired,
        
        // Targeting
        fid: discount.fid,
        whitelisted_fids: discount.whitelisted_fids,
        whitelisted_wallets: discount.whitelisted_wallets,
        contract_addresses: discount.contract_addresses,
        
        // Details
        minimum_order_amount: discount.minimum_order_amount,
        expires_at: discount.expires_at,
        created_at: discount.created_at,
        discount_description: discount.discount_description,
        free_shipping: discount.free_shipping,
        is_shared_code: discount.is_shared_code
      };
    });

    console.log(`✅ Successfully fetched ${formattedDiscounts.length} discount codes`);

    return NextResponse.json({
      success: true,
      data: formattedDiscounts,
      count: formattedDiscounts.length
    });

  } catch (error) {
    console.error('Error in admin discounts API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const {
      code,
      discount_type,
      discount_value,
      code_type,
      gating_type,
      target_fids,
      target_wallets,
      contract_addresses,
      chain_ids,
      required_balance,
      minimum_order_amount,
      expires_at,
      max_uses_total,
      max_uses_per_user,
      discount_description,
      free_shipping,
      is_shared_code
    } = await request.json();

    console.log('🎫 Creating new discount code:', code);

    // Validate required fields
    if (!code || !discount_type || !discount_value) {
      return NextResponse.json({
        success: false,
        error: 'Code, discount type, and discount value are required'
      }, { status: 400 });
    }

    // Check if code already exists
    const { data: existingCode, error: checkError } = await supabaseAdmin
      .from('discount_codes')
      .select('id')
      .eq('code', code)
      .single();

    if (existingCode) {
      return NextResponse.json({
        success: false,
        error: 'Discount code already exists'
      }, { status: 400 });
    }

    // Prepare discount data
    const discountData = {
      code: code.toUpperCase(),
      discount_type,
      discount_value: parseFloat(discount_value),
      code_type: code_type || 'promotional',
      gating_type: gating_type || 'none',
      minimum_order_amount: minimum_order_amount ? parseFloat(minimum_order_amount) : null,
      expires_at: expires_at ? new Date(expires_at).toISOString() : null,
      max_uses_total: max_uses_total ? parseInt(max_uses_total) : null,
      max_uses_per_user: max_uses_per_user ? parseInt(max_uses_per_user) : 1,
      discount_description: discount_description || null,
      free_shipping: free_shipping || false,
      is_shared_code: is_shared_code !== false, // Default to true for admin-created codes
      
      // Gating configuration
      whitelisted_fids: target_fids || [],
      whitelisted_wallets: target_wallets || [],
      contract_addresses: contract_addresses || [],
      chain_ids: chain_ids || [1], // Default to Ethereum mainnet
      required_balance: required_balance ? parseFloat(required_balance) : 1,
    };

    // If targeting specific FIDs and not shared, set the primary FID
    if (target_fids && target_fids.length === 1 && !is_shared_code) {
      discountData.fid = target_fids[0];
    }

    const { data: newDiscount, error: createError } = await supabaseAdmin
      .from('discount_codes')
      .insert([discountData])
      .select()
      .single();

    if (createError) {
      console.error('Error creating discount:', createError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create discount code'
      }, { status: 500 });
    }

    console.log('✅ Successfully created discount code:', newDiscount.code);

    return NextResponse.json({
      success: true,
      data: newDiscount
    });

  } catch (error) {
    console.error('Error creating discount code:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 