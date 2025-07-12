import { supabase } from './supabase';
import { shopifyAdminFetch } from './shopifyAdmin';

// Create gift card in Shopify
export async function createShopifyGiftCard(amount, note = null, expiresAt = null) {
  console.log('🎁 Creating Shopify gift card:', { amount, note, expiresAt });
  
  const mutation = `
    mutation giftCardCreate($input: GiftCardCreateInput!) {
      giftCardCreate(input: $input) {
        giftCard {
          id
          maskedCode
          balance {
            amount
            currencyCode
          }
          createdAt
          enabled
          note
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const variables = {
    input: {
      initialValue: amount.toString(),
      note: note
    }
  };
  
  console.log('Gift card mutation variables:', variables);
  
  const result = await shopifyAdminFetch(mutation, variables);
  console.log('Shopify gift card creation result:', result);
  
  return result.data.giftCardCreate;
}

// Validate gift card by code - using database lookup since GraphQL query is not available
export async function validateGiftCard(code) {
  console.log('🔍 Validating gift card:', code);
  
  // First check if we have this gift card in our database
  const dbGiftCard = await getGiftCardFromDatabase(code);
  
  if (!dbGiftCard) {
    console.log('Gift card not found in database');
    return null;
  }
  
  // Return a mock Shopify-style object with the data we have
  return {
    id: dbGiftCard.shopify_id,
    maskedCode: dbGiftCard.code,
    balance: {
      amount: dbGiftCard.current_balance.toString(),
      currencyCode: dbGiftCard.currency_code
    },
    enabled: dbGiftCard.status === 'active',
    createdAt: dbGiftCard.created_at,
    note: dbGiftCard.note
  };
}

// Get gift card balance
export async function getGiftCardBalance(code) {
  console.log('💰 Getting gift card balance:', code);
  
  const giftCard = await validateGiftCard(code);
  
  if (!giftCard) {
    return null;
  }
  
  return {
    balance: parseFloat(giftCard.balance.amount),
    currency: giftCard.balance.currencyCode,
    enabled: giftCard.enabled
  };
}

// Check if gift card is usable
export function isGiftCardUsable(giftCard) {
  if (!giftCard) return false;
  
  const hasBalance = parseFloat(giftCard.balance?.amount || 0) > 0;
  const isEnabled = giftCard.enabled === true;
  
  return hasBalance && isEnabled;
}

// Sync gift card with database
export async function syncGiftCardToDatabase(shopifyGiftCard, createdByFid = null, recipientEmail = null) {
  console.log('📊 Syncing gift card to database:', { 
    code: shopifyGiftCard.maskedCode,
    shopifyId: shopifyGiftCard.id,
    createdByFid,
    recipientEmail
  });
  
  const giftCardData = {
    code: shopifyGiftCard.maskedCode,
    shopify_id: shopifyGiftCard.id,
    initial_value: parseFloat(shopifyGiftCard.balance.amount),
    current_balance: parseFloat(shopifyGiftCard.balance.amount),
    currency_code: shopifyGiftCard.balance.currencyCode,
    status: shopifyGiftCard.enabled ? 'active' : 'disabled',
    created_by_fid: createdByFid,
    recipient_email: recipientEmail,
    note: shopifyGiftCard.note,
    synced_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('gift_cards')
    .upsert(giftCardData, {
      onConflict: 'code',
      ignoreDuplicates: false
    })
    .select()
    .single();
    
  if (error) {
    console.error('❌ Error syncing gift card to database:', error);
    throw error;
  }
  
  console.log('✅ Gift card synced to database:', data);
  return data;
}

// Get gift card from database
export async function getGiftCardFromDatabase(code) {
  console.log('🔍 Getting gift card from database:', code);
  
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('code', code)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    console.error('❌ Error getting gift card from database:', error);
    throw error;
  }
  
  return data;
}

// Update gift card balance after use
export async function updateGiftCardBalance(code, newBalance, orderId = null, fid = null) {
  console.log('💳 Updating gift card balance:', { code, newBalance, orderId, fid });
  
  // Update in database
  const { data, error } = await supabase
    .from('gift_cards')
    .update({
      current_balance: newBalance,
      last_used_at: new Date().toISOString(),
      use_count: supabase.sql`use_count + 1`
    })
    .eq('code', code)
    .select()
    .single();
    
  if (error) {
    console.error('❌ Error updating gift card balance:', error);
    throw error;
  }
  
  // Track usage history
  if (orderId && fid) {
    const giftCard = await getGiftCardFromDatabase(code);
    const amountUsed = (giftCard?.current_balance || 0) - newBalance;
    
    await trackGiftCardUsage(data.id, orderId, amountUsed, newBalance, fid);
  }
  
  console.log('✅ Gift card balance updated:', data);
  return data;
}

// Track gift card usage
export async function trackGiftCardUsage(giftCardId, orderId, amountUsed, balanceAfter, fid) {
  console.log('📝 Tracking gift card usage:', { 
    giftCardId, 
    orderId, 
    amountUsed, 
    balanceAfter, 
    fid 
  });
  
  const { data, error } = await supabase
    .from('gift_card_usage')
    .insert({
      gift_card_id: giftCardId,
      order_id: orderId,
      amount_used: amountUsed,
      balance_after: balanceAfter,
      fid: fid
    })
    .select()
    .single();
    
  if (error) {
    console.error('❌ Error tracking gift card usage:', error);
    throw error;
  }
  
  console.log('✅ Gift card usage tracked:', data);
  return data;
}

// Sync all gift cards from Shopify
export async function syncAllGiftCards(limit = 50) {
  console.log('🔄 Syncing all gift cards from Shopify');
  
  const query = `
    query giftCards($first: Int!) {
      giftCards(first: $first) {
        edges {
          node {
            id
            maskedCode
            balance {
              amount
              currencyCode
            }
            enabled
            createdAt
            note
          }
        }
      }
    }
  `;
  
  const result = await shopifyAdminFetch(query, { first: limit });
  const giftCards = result.data.giftCards.edges.map(edge => edge.node);
  
  console.log(`Found ${giftCards.length} gift cards in Shopify`);
  
  const syncResults = [];
  for (const giftCard of giftCards) {
    try {
      const syncedCard = await syncGiftCardToDatabase(giftCard);
      syncResults.push({ success: true, card: syncedCard });
    } catch (error) {
      console.error(`❌ Error syncing gift card ${giftCard.maskedCode}:`, error);
      syncResults.push({ success: false, error: error.message, code: giftCard.maskedCode });
    }
  }
  
  return {
    total: giftCards.length,
    successful: syncResults.filter(r => r.success).length,
    failed: syncResults.filter(r => !r.success).length,
    results: syncResults
  };
}

// Calculate gift card discount for checkout
export function calculateGiftCardDiscount(cartTotal, giftCardBalance) {
  const discount = Math.min(cartTotal, giftCardBalance);
  const remainingBalance = giftCardBalance - discount;
  const finalTotal = cartTotal - discount;
  
  return {
    discountAmount: discount,
    remainingBalance: remainingBalance,
    finalTotal: Math.max(0, finalTotal)
  };
}

// Validate gift card for checkout
export async function validateGiftCardForCheckout(code, cartTotal) {
  console.log('🛒 Validating gift card for checkout:', { code, cartTotal });
  
  const giftCard = await validateGiftCard(code);
  
  if (!giftCard) {
    return {
      isValid: false,
      error: 'Gift card not found',
      giftCard: null
    };
  }
  
  if (!isGiftCardUsable(giftCard)) {
    return {
      isValid: false,
      error: 'Gift card is not usable (disabled, expired, or no balance)',
      giftCard: giftCard
    };
  }
  
  const balance = parseFloat(giftCard.balance.amount);
  const discount = calculateGiftCardDiscount(cartTotal, balance);
  
  return {
    isValid: true,
    error: null,
    giftCard: giftCard,
    discount: discount
  };
} 