import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const discountData = await request.json();
    
    console.log('Creating discount code:', discountData);

    // Insert the discount code
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .insert({
        code: discountData.code,
        discount_type: discountData.discount_type || 'percentage',
        discount_value: discountData.discount_value,
        code_type: discountData.code_type || 'promotional',
        gating_type: discountData.gating_type || 'none',
        contract_addresses: discountData.contract_addresses || [],
        chain_ids: discountData.chain_ids || [1],
        required_balance: discountData.required_balance || 1,
        discount_scope: discountData.discount_scope || 'site_wide',
        target_products: discountData.target_products || [],
        target_collections: discountData.target_collections || [],
        max_uses_total: discountData.max_uses_total,
        max_uses_per_user: discountData.max_uses_per_user || 1,
        is_shared_code: discountData.is_shared_code || false,
        fid: discountData.fid || null,
        priority_level: discountData.priority_level || 0,
        auto_apply: discountData.auto_apply || false,
        expires_at: discountData.expires_at || null,
        discount_description: discountData.discount_description || '',
        campaign_id: discountData.campaign_id || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating discount code:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      discountCode: discountCode,
      message: `Discount code '${discountCode.code}' created successfully`
    });

  } catch (error) {
    console.error('Error in create discount endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create discount code',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Create discount code endpoint',
    usage: 'POST with discount code data',
    example: {
      code: 'BASEBANKR20',
      discount_type: 'percentage',
      discount_value: 20,
      code_type: 'promotional',
      gating_type: 'nft_holding',
      contract_addresses: ['0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82'],
      chain_ids: [8453],
      required_balance: 1,
      discount_scope: 'product',
      target_products: [13],
      max_uses_total: 69,
      max_uses_per_user: 1,
      is_shared_code: true,
      priority_level: 15,
      auto_apply: true,
      discount_description: '20% off Bankr Cap for Base NFT holders'
    }
  });
} 