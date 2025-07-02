import { NextResponse } from 'next/server';
import { getProductByHandle } from '@/lib/shopify';
import { getBestAvailableDiscount } from '@/lib/discounts';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');
    const fid = searchParams.get('fid'); // Optional: For discount checking

    if (!handle) {
      return NextResponse.json({ error: 'Product handle is required' }, { status: 400 });
    }

    console.log(`🛍️ Fetching product: ${handle}${fid ? ` for user FID: ${fid}` : ''}`);

    // Get product from Shopify
    const shopifyProduct = await getProductByHandle(handle);
    
    if (!shopifyProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get Supabase product ID for discount targeting
    let supabaseId = null;
    let availableDiscounts = null;
    
    try {
      // Get product from our Supabase products table
      const { data: supabaseProduct, error: supabaseError } = await supabase
        .from('products')
        .select('id')
        .eq('handle', handle)
        .single();

      if (!supabaseError && supabaseProduct) {
        supabaseId = supabaseProduct.id;
        console.log(`✅ Found Supabase product ID: ${supabaseId} for handle: ${handle}`);
      } else {
        console.log(`⚠️ No Supabase product found for handle: ${handle}`);
      }

      // If FID provided, check for available discounts
      if (fid && supabaseId) {
        const userFid = parseInt(fid);
        console.log(`🎁 Checking discounts for product ID ${supabaseId}, user FID ${userFid}`);
        
        // Check for product-specific discounts first
        const productDiscountResult = await getBestAvailableDiscount(userFid, 'product', [supabaseId]);
        
        // Check for site-wide discounts
        const siteWideDiscountResult = await getBestAvailableDiscount(userFid, 'site_wide');
        
        // Determine the best discount
        let bestDiscount = null;
        let scope = null;
        
        if (productDiscountResult.success && productDiscountResult.discountCode) {
          bestDiscount = productDiscountResult.discountCode;
          scope = 'product';
          console.log(`🎯 Best discount: ${bestDiscount.code} (product-specific, ${bestDiscount.discount_value}%)`);
        } else if (siteWideDiscountResult.success && siteWideDiscountResult.discountCode) {
          bestDiscount = siteWideDiscountResult.discountCode;
          scope = 'site_wide';
          console.log(`🌐 Best discount: ${bestDiscount.code} (site-wide, ${bestDiscount.discount_value}%)`);
        }
        
        availableDiscounts = {
          best: bestDiscount ? {
            code: bestDiscount.code,
            value: bestDiscount.discount_value,
            type: bestDiscount.discount_type,
            scope: scope,
            description: bestDiscount.discount_description,
            gating_type: bestDiscount.gating_type,
            priority_level: bestDiscount.priority_level,
            displayText: `${bestDiscount.discount_value}${bestDiscount.discount_type === 'percentage' ? '%' : '$'} off`,
            isTokenGated: !!bestDiscount.gating_type
          } : null,
          productSpecific: productDiscountResult.success ? productDiscountResult.discountCode : null,
          siteWide: siteWideDiscountResult.success ? siteWideDiscountResult.discountCode : null,
          alternatives: [
            ...(productDiscountResult.alternativeCodes || []),
            ...(siteWideDiscountResult.alternativeCodes || [])
          ]
        };
      }
    } catch (discountError) {
      console.error('❌ Error checking discounts:', discountError);
      // Don't fail the entire request, just continue without discount data
    }

    // Combine Shopify product with Supabase data
    const enhancedProduct = {
      ...shopifyProduct,
      supabaseId,
      availableDiscounts
    };

    console.log(`✅ Product data ready: ${shopifyProduct.title}${availableDiscounts?.best ? ` with ${availableDiscounts.best.code}` : ''}`);

    return NextResponse.json(enhancedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}