import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get('handle') || 'tiny-hyper-tee';
  const fid = searchParams.get('fid') || '466111';
  
  const logs = [];
  const log = (message) => {
    console.log(message);
    logs.push(message);
  };
  
  try {
    log(`🛍️ DEBUG: Testing product token-gating for handle: ${handle}, FID: ${fid}`);
    
    // Get Supabase product ID
    const supabaseId = 31; // We know this is the Tiny Hyper Tee ID
    log(`✅ Supabase product ID: ${supabaseId}`);
    
    if (fid && supabaseId) {
      const userFid = parseInt(fid);
      log(`🎁 Checking discounts for product ID ${supabaseId}, user FID ${userFid}`);
      
      // 🚨 CHECK FOR TOKEN-GATED DISCOUNTS
      let tokenGatedDiscount = null;
      try {
        log(`🚨 STARTING TOKEN-GATED CHECK for FID ${userFid}, Product ID ${supabaseId}`);
        
        // Get user's wallet addresses for token-gating
        const baseUrl = 'https://mintedmerch.vercel.app';
        log(`🔍 Using base URL for token-gated checking: ${baseUrl}`);
        
        const walletResponse = await fetch(`${baseUrl}/api/user-wallet-data?fid=${userFid}`);
        
        if (!walletResponse.ok) {
          log(`❌ Wallet API failed with status: ${walletResponse.status}`);
          const errorText = await walletResponse.text();
          log(`❌ Wallet API error: ${errorText}`);
        } else {
          const walletData = await walletResponse.json();
          log(`📱 Wallet API response: { success: ${walletData.success}, hasWallets: ${walletData.walletData?.all_wallet_addresses?.length > 0} }`);
          
          if (walletData.success && walletData.walletData?.all_wallet_addresses?.length > 0) {
            const userWalletAddresses = walletData.walletData.all_wallet_addresses;
            log(`🔍 Checking token-gated discounts for ${userWalletAddresses.length} wallet addresses`);
            log(`🔍 Wallet addresses: ${userWalletAddresses.slice(0, 3).join(', ')}...`);
            
                         // Check for all token-gated discounts (both product-specific and site-wide)
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
              log(`❌ Token-gated API failed with status: ${tokenGatedResponse.status}`);
              const errorText = await tokenGatedResponse.text();
              log(`❌ Token-gated API error: ${errorText}`);
            } else {
              const tokenGatedData = await tokenGatedResponse.json();
              log(`🎫 Token-gated API response: { success: ${tokenGatedData.success}, discountCount: ${tokenGatedData.eligibleDiscounts?.length || 0} }`);
              
              if (tokenGatedData.success && tokenGatedData.eligibleDiscounts?.length > 0) {
                log(`🎯 Found ${tokenGatedData.eligibleDiscounts.length} eligible token-gated discounts: ${tokenGatedData.eligibleDiscounts.map(d => d.code).join(', ')}`);
                
                // Show details of each discount
                tokenGatedData.eligibleDiscounts.forEach(discount => {
                  log(`  - ${discount.code}: ${discount.discount_value}% off, scope: ${discount.discount_scope}, priority: ${discount.priority_level}`);
                });
                
                // Separate product-specific and site-wide token-gated discounts
                const productSpecificTokenDiscounts = tokenGatedData.eligibleDiscounts.filter(d => d.discount_scope === 'product');
                const siteWideTokenDiscounts = tokenGatedData.eligibleDiscounts.filter(d => d.discount_scope === 'site_wide');
                
                log(`🔍 Product-specific token discounts: ${productSpecificTokenDiscounts.map(d => d.code).join(', ')}`);
                log(`🔍 Site-wide token discounts: ${siteWideTokenDiscounts.map(d => d.code).join(', ')}`);
                
                // Prioritize: product-specific token > site-wide token > regular product > regular site-wide
                if (productSpecificTokenDiscounts.length > 0) {
                  tokenGatedDiscount = productSpecificTokenDiscounts.reduce((best, current) => {
                    if (current.discount_value > best.discount_value) return current;
                    if (current.discount_value === best.discount_value && current.priority_level > best.priority_level) return current;
                    return best;
                  });
                  log(`🎯 Best product-specific token-gated discount: ${tokenGatedDiscount.code} (${tokenGatedDiscount.discount_value}% off)`);
                } else if (siteWideTokenDiscounts.length > 0) {
                  tokenGatedDiscount = siteWideTokenDiscounts.reduce((best, current) => {
                    if (current.discount_value > best.discount_value) return current;
                    if (current.discount_value === best.discount_value && current.priority_level > best.priority_level) return current;
                    return best;
                  });
                  log(`🎯 Best site-wide token-gated discount: ${tokenGatedDiscount.code} (${tokenGatedDiscount.discount_value}% off)`);
                }
                
                // Mark the token-gated discount
                if (tokenGatedDiscount) {
                  tokenGatedDiscount.isTokenGated = true;
                  tokenGatedDiscount.displayText = `${tokenGatedDiscount.discount_value}% off`;
                  log(`✅ Selected token-gated discount: ${tokenGatedDiscount.code} (${tokenGatedDiscount.displayText})`);
                }
              } else {
                log(`❌ No eligible token-gated discounts found for wallet addresses`);
              }
            }
          } else {
            log(`❌ User has no wallet addresses for token-gating`);
          }
        }
      } catch (error) {
        log(`❌ Error checking token-gated discounts: ${error.message}`);
        log(`❌ Stack trace: ${error.stack}`);
      }
      
      return Response.json({
        success: true,
        handle,
        fid,
        supabaseId,
        tokenGatedDiscount,
        logs
      });
    } else {
      log(`❌ Missing required parameters: fid=${fid}, supabaseId=${supabaseId}`);
      return Response.json({
        success: false,
        error: 'Missing required parameters',
        logs
      });
    }
  } catch (error) {
    log(`❌ Debug endpoint error: ${error.message}`);
    return Response.json({
      success: false,
      error: error.message,
      logs
    });
  }
} 