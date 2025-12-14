import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { withAdminAuth } from '@/lib/adminAuth';

// Update a discount code
export const PUT = withAdminAuth(async (request, { params }) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = params;
    const data = await request.json();
    
    // Validate required fields
    if (!data.code || !data.discount_type || !data.discount_value) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Prepare update data
    const parsedDiscountValue = parseFloat(data.discount_value);
    
    // Calculate priority_level based on discount type and value
    let priority_level = 0;
    if (data.discount_type === 'percentage') {
      // For percentage discounts, priority equals the percentage (20% = priority 20)
      priority_level = Math.round(parsedDiscountValue);
    } else if (data.discount_type === 'fixed') {
      // For fixed discounts, use a scaled priority based on dollar amount
      // $1-5 = priority 5, $6-10 = priority 10, $11-20 = priority 20, etc.
      if (parsedDiscountValue <= 5) priority_level = 5;
      else if (parsedDiscountValue <= 10) priority_level = 10;
      else if (parsedDiscountValue <= 20) priority_level = 20;
      else if (parsedDiscountValue <= 50) priority_level = 50;
      else priority_level = 100; // High priority for large fixed discounts
    }
    
    const updateData = {
      code: data.code.toUpperCase(),
      discount_type: data.discount_type,
      discount_value: parsedDiscountValue,
      code_type: data.code_type || 'promotional',
      gating_type: data.gating_type || 'none',
      discount_scope: data.discount_scope || 'site_wide',
      target_products: data.target_products || [],
      priority_level, // Auto-calculated based on discount value
      whitelisted_fids: data.target_fids || [],
      whitelisted_wallets: data.target_wallets || [],
      contract_addresses: data.contract_addresses || [],
      chain_ids: data.chain_ids || [1],
      required_balance: data.required_balance ? parseFloat(data.required_balance) : 1,
      nft_type: data.nft_type || 'erc721', // ERC-721 or ERC-1155
      token_ids: data.token_ids || [], // For ERC-1155 only
      minimum_order_amount: data.minimum_order_amount ? parseFloat(data.minimum_order_amount) : null,
      expires_at: data.expires_at || null,
      max_uses_total: data.max_uses_total ? parseInt(data.max_uses_total) : null,
      max_uses_per_user: data.max_uses_per_user ? parseInt(data.max_uses_per_user) : 1,
      discount_description: data.discount_description || null,
      free_shipping: data.free_shipping || false,
      is_shared_code: data.is_shared_code || false,
      auto_apply: data.auto_apply || false,
      updated_at: new Date().toISOString()
    };

    // Handle FID for user-specific codes
    if (data.gating_type === 'whitelist_fid' && data.target_fids && data.target_fids.length === 1) {
      updateData.fid = data.target_fids[0];
    } else {
      updateData.fid = null;
    }

    const { data: updatedDiscount, error } = await supabase
      .from('discount_codes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating discount:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      discount: updatedDiscount 
    });

  } catch (error) {
    console.error('Error in PUT /api/admin/discounts/[id]:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
});

// Delete a discount code
export const DELETE = withAdminAuth(async (request, { params }) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = params;

    // First check if the discount exists and get its details
    const { data: discount, error: fetchError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !discount) {
      return NextResponse.json({ 
        success: false, 
        error: 'Discount not found' 
      }, { status: 404 });
    }

    // Check if discount has been used
    const { data: usageData, error: usageError } = await supabase
      .from('discount_code_usage')
      .select('id')
      .eq('discount_code_id', id)
      .limit(1);

    if (usageError) {
      console.error('Error checking discount usage:', usageError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error checking discount usage' 
      }, { status: 500 });
    }

    // If discount has been used, we should not delete it (or ask for confirmation)
    if (usageData && usageData.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot delete discount that has been used. Consider deactivating it instead.' 
      }, { status: 400 });
    }

    // Delete the discount
    const { error: deleteError } = await supabase
      .from('discount_codes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting discount:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: deleteError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Discount deleted successfully' 
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/discounts/[id]:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}); 