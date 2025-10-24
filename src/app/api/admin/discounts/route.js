import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    
    // Extract filter parameters
    const filters = {
      searchTerm: searchParams.get('search') || '',
      gatingType: searchParams.get('gatingType') || 'all',
      codeType: searchParams.get('codeType') || 'all',
      status: searchParams.get('status') || 'all',
      discountScope: searchParams.get('discountScope') || 'all'
    };

    console.log(`🎫 Fetching discount codes for admin dashboard (page ${page}, limit ${limit}, filters:`, filters, ')...');

    // Build base query with filters
    const buildFilteredQuery = (query) => {
      // Search filter
      if (filters.searchTerm) {
        query = query.or(`code.ilike.%${filters.searchTerm}%,discount_description.ilike.%${filters.searchTerm}%`);
      }
      
      // Gating type filter
      if (filters.gatingType !== 'all') {
        query = query.eq('gating_type', filters.gatingType);
      }
      
      // Code type filter
      if (filters.codeType !== 'all') {
        query = query.eq('code_type', filters.codeType);
      }
      
      // Discount scope filter
      if (filters.discountScope !== 'all') {
        query = query.eq('discount_scope', filters.discountScope);
      }
      
      return query;
    };

    // Get filtered count first
    let countQuery = supabaseAdmin
      .from('discount_codes')
      .select('*', { count: 'exact', head: true });
    
    countQuery = buildFilteredQuery(countQuery);
    
    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('Error getting filtered discount count:', countError);
      return NextResponse.json({
        success: false,
        error: 'Failed to get discount count'
      }, { status: 500 });
    }

    // Fetch filtered discount codes with usage counts
    let dataQuery = supabaseAdmin
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
    
    dataQuery = buildFilteredQuery(dataQuery);
    dataQuery = dataQuery.range(offset, offset + limit - 1);
    
    const { data: discounts, error: discountsError } = await dataQuery;

    if (discountsError) {
      console.error('Error fetching discounts:', discountsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch discounts'
      }, { status: 500 });
    }

    // Format discounts with usage statistics
    let formattedDiscounts = discounts.map(discount => {
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
        discount_scope: discount.discount_scope,
        target_products: discount.target_products,
        target_product_ids: discount.target_product_ids,
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

    // Apply status filter (needs to be done after calculating is_active/is_expired)
    if (filters.status !== 'all') {
      formattedDiscounts = formattedDiscounts.filter(discount => {
        if (filters.status === 'active' && !discount.is_active) return false;
        if (filters.status === 'expired' && !discount.is_expired) return false;
        if (filters.status === 'inactive' && (discount.is_active || discount.is_expired)) return false;
        return true;
      });
    }

    console.log(`✅ Successfully fetched ${formattedDiscounts.length} of ${totalCount} discount codes (page ${page})`);

    return NextResponse.json({
      success: true,
      data: formattedDiscounts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      },
      count: formattedDiscounts.length
    });

  } catch (error) {
    console.error('Error in admin discounts API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});

export const POST = withAdminAuth(async (request) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      code_type,
      gating_type,
      discount_scope,
      target_products,
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
      is_shared_code,
      auto_apply
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
    const parsedDiscountValue = parseFloat(discount_value);
    
    // Calculate priority_level based on discount type and value
    let priority_level = 0;
    if (discount_type === 'percentage') {
      // For percentage discounts, priority equals the percentage (20% = priority 20)
      priority_level = Math.round(parsedDiscountValue);
    } else if (discount_type === 'fixed') {
      // For fixed discounts, use a scaled priority based on dollar amount
      // $1-5 = priority 5, $6-10 = priority 10, $11-20 = priority 20, etc.
      if (parsedDiscountValue <= 5) priority_level = 5;
      else if (parsedDiscountValue <= 10) priority_level = 10;
      else if (parsedDiscountValue <= 20) priority_level = 20;
      else if (parsedDiscountValue <= 50) priority_level = 50;
      else priority_level = 100; // High priority for large fixed discounts
    }
    
    const discountData = {
      code: code.toUpperCase(),
      discount_type,
      discount_value: parsedDiscountValue,
      code_type: code_type || 'promotional',
      gating_type: gating_type || 'none',
      discount_scope: discount_scope || 'site_wide',
      target_products: target_products || [],
      priority_level, // Auto-calculated based on discount value
      minimum_order_amount: minimum_order_amount ? parseFloat(minimum_order_amount) : null,
      expires_at: expires_at ? new Date(expires_at).toISOString() : null,
      max_uses_total: max_uses_total ? parseInt(max_uses_total) : null,
      max_uses_per_user: max_uses_per_user ? parseInt(max_uses_per_user) : 1,
      discount_description: discount_description || null,
      free_shipping: free_shipping || false,
      is_shared_code: is_shared_code !== false, // Default to true for admin-created codes
      auto_apply: auto_apply !== false, // Default to true for admin-created codes
      
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
}); 