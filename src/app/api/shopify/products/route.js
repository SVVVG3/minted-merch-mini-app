import { NextResponse } from 'next/server';
import { setUserContext } from '@/lib/auth';
import { getProductByHandle } from '@/lib/shopify';
import { getBestAvailableDiscount } from '@/lib/discounts';
import { supabase } from '@/lib/supabase';

// Cache product data for 5 minutes on Vercel CDN when no user-specific data is requested
// This dramatically reduces function invocations for product page loads
const CACHE_HEADERS = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');
    const fid = searchParams.get('fid'); // Optional: For discount checking
    const includeDiscounts = searchParams.get('includeDiscounts') === 'true';

    if (!handle) {
      return NextResponse.json({ error: 'Product handle is required' }, { status: 400 });
    }

    console.log(`🛍️ Fetching product: ${handle}${fid ? ` for user FID: ${fid}` : ''}`);

    // 🔒 SECURITY: Set user context for RLS policies if FID provided
    if (fid) {
      await setUserContext(fid);
    }

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
            ? (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop')
            : 'http://localhost:3000';
          
          console.log(`🔍 Using base URL for token-gated checking: ${baseUrl}`);
          
          // 🔧 CRITICAL FIX: Always check token-gated discounts, even without wallets
          // Some discounts (like Bankr Club) are FID-based and don't require wallets
          let userWalletAddresses = [];
          
          try {
            // 🔒 SECURITY FIX: Call function directly instead of HTTP to avoid auth issues
            // Server-side calls don't have JWT tokens, so we import the function directly
            const { fetchUserWalletDataFromDatabase } = await import('@/lib/walletUtils');
            const walletData = await fetchUserWalletDataFromDatabase(parseInt(userFid));
            
            if (walletData && walletData.all_wallet_addresses?.length > 0) {
              userWalletAddresses = walletData.all_wallet_addresses;
              console.log(`🔍 Found ${userWalletAddresses.length} wallet addresses`);
            } else {
              console.log(`📱 No wallet addresses found, but will still check FID-based discounts`);
            }
          } catch (walletError) {
            console.log(`⚠️ Wallet API error: ${walletError.message}, but will still check FID-based discounts`);
          }
          
          // Always check token-gated discounts (FID-based discounts work without wallets)
          console.log(`🔍 Checking token-gated discounts for FID ${userFid} with ${userWalletAddresses.length} wallet addresses`);
          
          // Check for all token-gated discounts (both product-specific and site-wide)
          // Use normal mode (not cache-only) to ensure product-specific discounts work correctly
          const tokenGatedResponse = await fetch(`${baseUrl}/api/check-token-gated-eligibility`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fid: userFid,
              walletAddresses: userWalletAddresses,
              productIds: [supabaseId],
              scope: 'all'
            })
          });
              
          if (!tokenGatedResponse.ok) {
            console.error(`❌ Token-gated API failed with status: ${tokenGatedResponse.status}`);
            console.error(`❌ Token-gated API error: ${await tokenGatedResponse.text()}`);
          } else {
            const tokenGatedData = await tokenGatedResponse.json();
            console.log(`🎫 Token-gated API response: { success: ${tokenGatedData.success}, discountCount: ${tokenGatedData.eligibleDiscounts?.length || 0} }`);
        
            if (tokenGatedData.success && tokenGatedData.eligibleDiscounts?.length > 0) {
              console.log(`🎯 Found ${tokenGatedData.eligibleDiscounts.length} eligible token-gated discounts: ${tokenGatedData.eligibleDiscounts.map(d => d.code).join(', ')}`);
              
              // Separate product-specific and site-wide token-gated discounts
              const productSpecificTokenDiscounts = tokenGatedData.eligibleDiscounts.filter(d => d.discount_scope === 'product');
              const siteWideTokenDiscounts = tokenGatedData.eligibleDiscounts.filter(d => d.discount_scope === 'site_wide');
                  
              console.log(`🔍 Product-specific token discounts: ${productSpecificTokenDiscounts.map(d => d.code).join(', ')}`);
              console.log(`🔍 Site-wide token discounts: ${siteWideTokenDiscounts.map(d => d.code).join(', ')}`);
              
              // FIXED: Compare ALL token-gated discounts by value first, not by scope preference
              // Value should win, then product-specific beats site-wide at same value
              let bestProductDiscount = null;
              let bestSiteWideDiscount = null;
              
              if (productSpecificTokenDiscounts.length > 0) {
                // Find the best product-specific token-gated discount
                bestProductDiscount = productSpecificTokenDiscounts.reduce((best, current) => {
                  if (current.discount_value > best.discount_value) return current;
                  if (current.discount_value === best.discount_value && current.priority_level > best.priority_level) return current;
                  return best;
                });
                console.log(`🎯 Best product-specific token-gated discount: ${bestProductDiscount.code} (${bestProductDiscount.discount_value}% off)`);
              }
              
              if (siteWideTokenDiscounts.length > 0) {
                // Find the best site-wide token-gated discount
                bestSiteWideDiscount = siteWideTokenDiscounts.reduce((best, current) => {
                  if (current.discount_value > best.discount_value) return current;
                  if (current.discount_value === best.discount_value && current.priority_level > best.priority_level) return current;
                  return best;
                });
                console.log(`🎯 Best site-wide token-gated discount: ${bestSiteWideDiscount.code} (${bestSiteWideDiscount.discount_value}% off)`);
              }
              
              // Now compare the best from each category - HIGHEST VALUE WINS
              if (bestProductDiscount && bestSiteWideDiscount) {
                if (bestSiteWideDiscount.discount_value > bestProductDiscount.discount_value) {
                  tokenGatedDiscount = bestSiteWideDiscount;
                  console.log(`🏆 Site-wide discount wins: ${bestSiteWideDiscount.code} (${bestSiteWideDiscount.discount_value}%) > ${bestProductDiscount.code} (${bestProductDiscount.discount_value}%)`);
                } else if (bestProductDiscount.discount_value > bestSiteWideDiscount.discount_value) {
                  tokenGatedDiscount = bestProductDiscount;
                  console.log(`🏆 Product discount wins: ${bestProductDiscount.code} (${bestProductDiscount.discount_value}%) > ${bestSiteWideDiscount.code} (${bestSiteWideDiscount.discount_value}%)`);
                } else {
                  // Same value - prefer product-specific (more targeted)
                  tokenGatedDiscount = bestProductDiscount;
                  console.log(`🏆 Same value, product discount wins (more targeted): ${bestProductDiscount.code}`);
                }
              } else {
                tokenGatedDiscount = bestProductDiscount || bestSiteWideDiscount;
                if (tokenGatedDiscount) {
                  console.log(`🎯 Only one category available: ${tokenGatedDiscount.code} (${tokenGatedDiscount.discount_value}% off)`);
                }
              }
              
              // Mark the token-gated discount
              if (tokenGatedDiscount) {
                tokenGatedDiscount.isTokenGated = true;
                // Format displayText based on discount_type (percentage vs fixed amount)
                if (tokenGatedDiscount.discount_type === 'fixed') {
                  tokenGatedDiscount.displayText = `$${tokenGatedDiscount.discount_value} off`;
                } else {
                  tokenGatedDiscount.displayText = `${tokenGatedDiscount.discount_value}% off`;
                }
                console.log(`✅ Selected token-gated discount: ${tokenGatedDiscount.code} (${tokenGatedDiscount.displayText})`);
              }
            } else {
              console.log(`❌ No eligible token-gated discounts found`);
            }
          }
        } catch (error) {
          console.error('❌ Error checking token-gated discounts:', error);
          console.error('❌ Stack trace:', error.stack);
        }
        
        // Now determine the best discount with proper prioritization
        const discounts = [
          tokenGatedDiscount,
          productDiscountResult?.discountCode,
          siteWideDiscountResult?.discountCode
        ].filter(Boolean);
        
        console.log(`🎯 Available discounts for prioritization: ${discounts.map(d => `${d.code} (${d.discount_value || d.value}% off, ${d.discount_scope || d.scope}, tokenGated: ${d.isTokenGated || false})`).join(', ')}`);
        
        let bestDiscount = null;
        if (discounts.length > 0) {
          // PRIORITY: Higher value wins first, then token-gated > regular, then product > site-wide
          bestDiscount = discounts.reduce((best, current) => {
            // Normalize property names
            const currentValue = current.discount_value || current.value;
            const bestValue = best.discount_value || best.value;
            const currentScope = current.discount_scope || current.scope;
            const bestScope = best.discount_scope || best.scope;
            
            // 1. HIGHEST VALUE WINS - Users should always get the best discount
            if (currentValue > bestValue) return current;
            if (currentValue < bestValue) return best;
            
            // 2. Same value: Token-gated beats regular (they verified their holding)
            if (current.isTokenGated && !best.isTokenGated) return current;
            if (!current.isTokenGated && best.isTokenGated) return best;
            
            // 3. Same value and gating: Product-specific beats site-wide (more targeted)
            if (currentScope === 'product' && bestScope === 'site_wide') return current;
            if (currentScope === 'site_wide' && bestScope === 'product') return best;
            
            // 4. Tiebreaker: Priority level
            if (current.priority_level > best.priority_level) return current;
            
            return best;
          });
          
          const finalValue = bestDiscount.discount_value || bestDiscount.value;
          const finalScope = bestDiscount.discount_scope || bestDiscount.scope;
          console.log(`🏆 FINAL BEST DISCOUNT: ${bestDiscount.code} (${finalValue}% off, ${finalScope}, tokenGated: ${bestDiscount.isTokenGated || false})`);
        }
        
        // Set available discounts in response
        availableDiscounts = {
          best: bestDiscount,
          productSpecific: productDiscountResult?.discountCode,
          siteWide: siteWideDiscountResult?.discountCode,
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

    // Only cache when no user-specific data is requested (no fid = no personalized discounts)
    // This allows caching for anonymous product views while keeping personalized responses fresh
    const responseHeaders = fid ? {} : CACHE_HEADERS;
    
    return NextResponse.json(enhancedProduct, { headers: responseHeaders });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}