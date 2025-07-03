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
        
        // 🚨 ALSO CHECK FOR TOKEN-GATED DISCOUNTS
        let tokenGatedDiscount = null;
        try {
          console.log(`🚨 STARTING TOKEN-GATED CHECK for FID ${userFid}, Product ID ${supabaseId}`);
          
          // Get user's wallet addresses for token-gating
          // Use proper base URL for server-side requests
          const baseUrl = process.env.NODE_ENV === 'production' 
            ? 'https://mintedmerch.vercel.app' 
            : 'http://localhost:3000';
          
          console.log(`🔍 Using base URL for token-gated checking: ${baseUrl}`);
          
          const walletResponse = await fetch(`${baseUrl}/api/user-wallet-data?fid=${userFid}`);
          
          if (!walletResponse.ok) {
            console.error(`❌ Wallet API failed with status: ${walletResponse.status}`);
            throw new Error(`Wallet API failed: ${walletResponse.status}`);
          }
          
          const walletData = await walletResponse.json();
          console.log(`📱 Wallet API response:`, { success: walletData.success, hasWallets: !!walletData.walletData?.all_wallet_addresses });
          
          if (walletData.success && walletData.walletData?.all_wallet_addresses?.length > 0) {
            const userWalletAddresses = walletData.walletData.all_wallet_addresses;
            console.log(`🔍 Checking token-gated discounts for ${userWalletAddresses.length} wallet addresses`);
            
            // Check for all token-gated discounts (product-specific and site-wide)
            const tokenGatingResponse = await fetch(`${baseUrl}/api/check-token-gated-eligibility`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fid: userFid,
                walletAddresses: userWalletAddresses,
                scope: 'all', // Check all token-gated discounts
                productIds: [supabaseId]
              })
            });
            
            if (!tokenGatingResponse.ok) {
              console.error(`❌ Token-gated API failed with status: ${tokenGatingResponse.status}`);
              throw new Error(`Token-gated API failed: ${tokenGatingResponse.status}`);
            }
            
            const tokenGatingResult = await tokenGatingResponse.json();
            console.log(`🎫 Token-gated API response:`, { success: tokenGatingResult.success, discountCount: tokenGatingResult.eligibleDiscounts?.length || 0 });
            
            if (tokenGatingResult.success && tokenGatingResult.eligibleDiscounts?.length > 0) {
              console.log(`🎯 Found ${tokenGatingResult.eligibleDiscounts.length} eligible token-gated discounts:`, tokenGatingResult.eligibleDiscounts.map(d => ({ code: d.code, value: d.discount_value, scope: d.discount_scope })));
              
              // Find the best token-gated discount (prioritize product-specific, then site-wide)
              const productSpecificTokenDiscount = tokenGatingResult.eligibleDiscounts.find(d => 
                d.target_product_ids && d.target_product_ids.includes(supabaseId)
              );
              
              const siteWideTokenDiscount = tokenGatingResult.eligibleDiscounts.find(d => 
                d.discount_scope === 'site_wide'
              );
              
              console.log(`🔍 Product-specific token discount:`, productSpecificTokenDiscount ? productSpecificTokenDiscount.code : 'None');
              console.log(`🔍 Site-wide token discount:`, siteWideTokenDiscount ? siteWideTokenDiscount.code : 'None');
              
              // Prioritize product-specific token-gated discounts
              const selectedTokenDiscount = productSpecificTokenDiscount || siteWideTokenDiscount;
              
              if (selectedTokenDiscount) {
                tokenGatedDiscount = {
                  code: selectedTokenDiscount.code,
                  discount_value: selectedTokenDiscount.discount_value,
                  discount_type: selectedTokenDiscount.discount_type,
                  discount_description: selectedTokenDiscount.discount_description,
                  gating_type: selectedTokenDiscount.gating_type,
                  priority_level: selectedTokenDiscount.priority_level
                };
                console.log(`🎯 Found token-gated discount: ${tokenGatedDiscount.code} (${tokenGatedDiscount.discount_value}% off, ${selectedTokenDiscount.discount_scope})`);
              }
            } else {
              console.log(`⚠️ No eligible token-gated discounts found`);
            }
          } else {
            console.log(`⚠️ No wallet addresses found for user FID ${userFid}`);
          }
        } catch (error) {
          console.error('❌ Error checking token-gated discounts:', error);
        }
        
        // Determine the best discount (prioritize token-gated, then product-specific, then site-wide)
        let bestDiscount = null;
        let scope = null;
        
        if (tokenGatedDiscount) {
          bestDiscount = tokenGatedDiscount;
          scope = 'product';
          console.log(`🎯 Best discount: ${bestDiscount.code} (token-gated product-specific, ${bestDiscount.discount_value}% off)`);
        } else if (productDiscountResult.success && productDiscountResult.discountCode) {
          bestDiscount = productDiscountResult.discountCode;
          scope = 'product';
          console.log(`🎯 Best discount: ${bestDiscount.code} (product-specific, ${bestDiscount.discount_value}% off)`);
        } else if (siteWideDiscountResult.success && siteWideDiscountResult.discountCode) {
          bestDiscount = siteWideDiscountResult.discountCode;
          scope = 'site_wide';
          console.log(`🌐 Best discount: ${bestDiscount.code} (site-wide, ${bestDiscount.discount_value}% off)`);
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