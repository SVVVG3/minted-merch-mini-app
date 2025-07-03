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
            console.error(`❌ Wallet API error: ${await walletResponse.text()}`);
          } else {
            const walletData = await walletResponse.json();
            console.log(`📱 Wallet API response: { success: ${walletData.success}, hasWallets: ${walletData.walletData?.all_wallet_addresses?.length > 0} }`);
            
            if (walletData.success && walletData.walletData?.all_wallet_addresses?.length > 0) {
              const userWalletAddresses = walletData.walletData.all_wallet_addresses;
              console.log(`🔍 Checking token-gated discounts for ${userWalletAddresses.length} wallet addresses`);
              
                          // Check for all token-gated discounts (both product-specific and site-wide)
            const tokenGatedResponse = await fetch(`${baseUrl}/api/check-token-gated-eligibility`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fid: userFid,
                walletAddresses: userWalletAddresses,
                product_id: supabaseId,
                scope: 'all'
              })
            });
              
              if (!tokenGatedResponse.ok) {
                console.error(`❌ Token-gated API failed with status: ${tokenGatedResponse.status}`);
                console.error(`❌ Token-gated API error: ${await tokenGatedResponse.text()}`);
              } else {
                const tokenGatedData = await tokenGatedResponse.json();
                console.log(`🎫 Token-gated API response: { success: ${tokenGatedData.success}, discountCount: ${tokenGatedData.eligible_discounts?.length || 0} }`);
                
                if (tokenGatedData.success && tokenGatedData.eligible_discounts?.length > 0) {
                  console.log(`🎯 Found ${tokenGatedData.eligible_discounts.length} eligible token-gated discounts: ${tokenGatedData.eligible_discounts.map(d => d.code).join(', ')}`);
                  
                  // Separate product-specific and site-wide token-gated discounts
                  const productSpecificTokenDiscounts = tokenGatedData.eligible_discounts.filter(d => d.scope === 'product');
                  const siteWideTokenDiscounts = tokenGatedData.eligible_discounts.filter(d => d.scope === 'site_wide');
                  
                  console.log(`🔍 Product-specific token discounts: ${productSpecificTokenDiscounts.map(d => d.code).join(', ')}`);
                  console.log(`🔍 Site-wide token discounts: ${siteWideTokenDiscounts.map(d => d.code).join(', ')}`);
                  
                  // Prioritize: product-specific token > site-wide token > regular product > regular site-wide
                  if (productSpecificTokenDiscounts.length > 0) {
                    // Find the best product-specific token-gated discount
                    tokenGatedDiscount = productSpecificTokenDiscounts.reduce((best, current) => {
                      if (current.value > best.value) return current;
                      if (current.value === best.value && current.priority_level > best.priority_level) return current;
                      return best;
                    });
                    console.log(`🎯 Best product-specific token-gated discount: ${tokenGatedDiscount.code} (${tokenGatedDiscount.value}% off)`);
                  } else if (siteWideTokenDiscounts.length > 0) {
                    // Find the best site-wide token-gated discount
                    tokenGatedDiscount = siteWideTokenDiscounts.reduce((best, current) => {
                      if (current.value > best.value) return current;
                      if (current.value === best.value && current.priority_level > best.priority_level) return current;
                      return best;
                    });
                    console.log(`🎯 Best site-wide token-gated discount: ${tokenGatedDiscount.code} (${tokenGatedDiscount.value}% off)`);
                  }
                  
                  // Mark the token-gated discount
                  if (tokenGatedDiscount) {
                    tokenGatedDiscount.isTokenGated = true;
                    tokenGatedDiscount.displayText = `${tokenGatedDiscount.value}% off`;
                    console.log(`✅ Selected token-gated discount: ${tokenGatedDiscount.code} (${tokenGatedDiscount.displayText})`);
                  }
                } else {
                  console.log(`❌ No eligible token-gated discounts found for wallet addresses`);
                }
              }
            } else {
              console.log(`❌ User has no wallet addresses for token-gating`);
            }
          }
        } catch (error) {
          console.error('❌ Error checking token-gated discounts:', error);
          console.error('❌ Stack trace:', error.stack);
        }
        
        // Now determine the best discount with proper prioritization
        const discounts = [
          tokenGatedDiscount,
          productDiscountResult?.discount,
          siteWideDiscountResult?.discount
        ].filter(Boolean);
        
        console.log(`🎯 Available discounts for prioritization: ${discounts.map(d => `${d.code} (${d.value}% off, ${d.scope}, tokenGated: ${d.isTokenGated})`).join(', ')}`);
        
        let bestDiscount = null;
        if (discounts.length > 0) {
          // Sort by priority: token-gated product > token-gated site > regular product > regular site
          bestDiscount = discounts.reduce((best, current) => {
            // Token-gated discounts have highest priority
            if (current.isTokenGated && !best.isTokenGated) return current;
            if (!current.isTokenGated && best.isTokenGated) return best;
            
            // Among same gating type, product-specific beats site-wide
            if (current.scope === 'product' && best.scope === 'site_wide') return current;
            if (current.scope === 'site_wide' && best.scope === 'product') return best;
            
            // Among same scope and gating, higher value wins
            if (current.value > best.value) return current;
            if (current.value === best.value && current.priority_level > best.priority_level) return current;
            
            return best;
          });
          
          console.log(`🏆 FINAL BEST DISCOUNT: ${bestDiscount.code} (${bestDiscount.value}% off, ${bestDiscount.scope}, tokenGated: ${bestDiscount.isTokenGated})`);
        }
        
        // Set available discounts in response
        availableDiscounts = {
          best: bestDiscount,
          productSpecific: productDiscountResult?.discount,
          siteWide: siteWideDiscountResult?.discount,
          tokenGated: tokenGatedDiscount,
          alternatives: discounts.filter(d => d !== bestDiscount)
        };
      } else {
        console.log(`❌ Missing required parameters for discount checking: fid=${fid}, supabaseId=${supabaseId}`);
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