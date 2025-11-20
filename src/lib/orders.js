import { supabase, supabaseAdmin } from './supabase';
import { sendOrderConfirmationNotification, sendShippingNotification } from './neynar';
import { validateDiscountCode } from './discounts';

/**
 * Ensure user profile exists before order creation
 * @param {number} fid - Farcaster ID
 * @param {string} customerEmail - Customer email from order
 * @param {string} customerName - Customer name from order
 * @param {object} userDataFromFrontend - Real Farcaster data from SDK (username, displayName, pfpUrl)
 */
async function ensureUserProfileExists(fid, customerEmail, customerName, userDataFromFrontend = null) {
  try {
    console.log('🔍 Checking if user profile exists for FID:', fid);

    // Check if profile already exists
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('fid')
      .eq('fid', fid)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing profile:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (existingProfile) {
      console.log('✅ User profile already exists for FID:', fid);
      return { success: true, profile: existingProfile };
    }

    // Profile doesn't exist, create it with REAL data
    console.log('👤 Creating user profile for FID:', fid);
    
    // 🔒 SAME FIX AS SPIN WHEEL: Use real data from frontend SDK FIRST
    let realUsername = `user_${fid}`;
    let realDisplayName = customerName || `User ${fid}`;
    let realPfpUrl = null;
    
    if (userDataFromFrontend?.username) {
      realUsername = userDataFromFrontend.username;
      realDisplayName = userDataFromFrontend.displayName || realDisplayName;
      realPfpUrl = userDataFromFrontend.pfpUrl;
      console.log(`✅ Using real data from frontend SDK for FID ${fid}: @${realUsername}`);
    } else {
      console.warn(`⚠️ No frontend data available for FID ${fid}, using placeholder`);
    }
    
    const profileData = {
      fid: fid,
      username: realUsername,      // Real username from SDK!
      display_name: realDisplayName,  // Real display name from SDK!
      pfp_url: realPfpUrl,          // Real profile picture from SDK!
      email: customerEmail,
      email_updated_at: new Date().toISOString(),
      has_notifications: false, // Default to false, will be updated by registration flow
      bankr_club_member: false, // Default to false, will be updated by registration flow
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newProfile, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating user profile:', createError);
      return { success: false, error: createError.message };
    }

    console.log('✅ User profile created successfully for FID:', fid, 'with username:', realUsername);
    return { success: true, profile: newProfile };

  } catch (error) {
    console.error('Error in ensureUserProfileExists:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate discount code before order creation
 */
export async function validateDiscountForOrder(discountCode, fid, subtotal, cartItems = []) {
  try {
    if (!discountCode) {
      return { success: true, isValid: false }; // No discount code provided
    }

    console.log('Validating discount code for order creation:', { discountCode, fid, subtotal, hasCartItems: !!cartItems });

    // Import cart gift card check
    const { cartContainsGiftCards } = await import('./discounts');
    
    // Check if cart contains gift cards - if so, block discount application
    if (cartItems && cartContainsGiftCards(cartItems)) {
      console.log('🚫 Order contains gift cards, blocking discount application');
      return {
        success: false,
        error: 'Discount codes cannot be applied to orders containing gift cards',
        isValid: false
      };
    }

    // Validate the discount code
    const validationResult = await validateDiscountCode(discountCode, fid);
    
    if (!validationResult.success || !validationResult.isValid) {
      console.log('Discount code validation failed:', validationResult.error);
      return {
        success: false,
        error: validationResult.error || 'Invalid discount code',
        isValid: false
      };
    }

    // Double-check that the code hasn't been used (race condition protection)
    const { data: discountCodeData, error: fetchError } = await supabaseAdmin
      .from('discount_codes')
      .select('is_used, used_at, order_id')
      .eq('code', discountCode.toUpperCase())
      .single();

    if (fetchError) {
      console.error('Error fetching discount code for validation:', fetchError);
      return {
        success: false,
        error: 'Failed to validate discount code',
        isValid: false
      };
    }

    if (discountCodeData.is_used) {
      console.log('Discount code already used:', discountCodeData);
      return {
        success: false,
        error: 'This discount code has already been used',
        isValid: false
      };
    }

    // 🔒 CRITICAL SECURITY FIX: Check token gating requirements for order processing
    const discountCodeObj = validationResult.discountCode;
    if (discountCodeObj && discountCodeObj.gating_type && discountCodeObj.gating_type !== 'none') {
      console.log('🎫 Token-gated discount detected during order processing, checking eligibility:', {
        code: discountCodeObj.code,
        gating_type: discountCodeObj.gating_type,
        fid
      });

      if (!fid) {
        return {
          success: false,
          error: 'Authentication required for this discount code',
          isValid: false
        };
      }

      // Note: Token gating validation is now handled in the API route before order creation
      // This ensures proper server-side validation without client-side import issues
    }

    console.log('✅ Discount code is valid for order creation');
    return {
      success: true,
      isValid: true,
      discountCode: validationResult.discountCode,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue
    };

  } catch (error) {
    console.error('Error validating discount code for order:', error);
    return {
      success: false,
      error: 'Failed to validate discount code',
      isValid: false
    };
  }
}

/**
 * Create a new order in the database with enhanced discount tracking
 */
export async function createOrder(orderData) {
  try {
    console.log('🔍 Creating order in database with detailed data:', {
      fid: orderData.fid,
      orderId: orderData.orderId,
      amountTotal: orderData.amountTotal,
      amountSubtotal: orderData.amountSubtotal,
      discountCode: orderData.discountCode,
      hasLineItems: !!orderData.lineItems,
      lineItemsLength: orderData.lineItems?.length,
      lineItemsStructure: orderData.lineItems?.map(item => ({
        hasId: !!item.id,
        hasTitle: !!item.title,
        hasPrice: !!item.price,
        hasQuantity: !!item.quantity,
        id: item.id,
        title: item.title,
        price: item.price,
        quantity: item.quantity
      })),
      fullOrderData: orderData
    });

    // CRITICAL FIX: Ensure user profile exists before creating order
    if (orderData.fid) {
      const profileResult = await ensureUserProfileExists(
        orderData.fid, 
        orderData.customerEmail, 
        orderData.customerName,
        orderData.userData // 🔒 Pass real Farcaster data from frontend
      );
      
      if (!profileResult.success) {
        console.error('❌ Failed to ensure user profile exists:', profileResult.error);
        return { success: false, error: `Failed to create user profile: ${profileResult.error}` };
      }
    }

    // Skip discount validation during order creation - discount was already validated during checkout
    if (orderData.discountCode) {
      console.log('💡 Discount code present in order:', {
        discountCode: orderData.discountCode,
        fid: orderData.fid,
        amountSubtotal: orderData.amountSubtotal,
        note: 'Skipping re-validation - discount already validated during checkout'
      });
    }

    // Create the order
    console.log('🔍 Attempting to insert order into database...');
    
    // Calculate gift card summary data
    const giftCardSummary = orderData.giftCards && Array.isArray(orderData.giftCards) ? {
      codes: orderData.giftCards.filter(gc => gc.code).map(gc => gc.code.toUpperCase()),
      totalUsed: orderData.giftCards.reduce((sum, gc) => sum + parseFloat(gc.amountUsed || 0), 0),
      count: orderData.giftCards.filter(gc => gc.code && parseFloat(gc.amountUsed || 0) > 0).length
    } : { codes: [], totalUsed: 0, count: 0 };

    const insertData = {
      fid: orderData.fid,
      order_id: orderData.orderId,
      session_id: orderData.sessionId,
      status: orderData.status || 'pending',
      currency: orderData.currency || 'USDC',
      amount_total: orderData.amountTotal,
      amount_subtotal: orderData.amountSubtotal,
      amount_tax: orderData.amountTax,
      amount_shipping: orderData.amountShipping,
      discount_code: orderData.discountCode || null,
      discount_amount: orderData.discountAmount || 0,
      discount_percentage: orderData.discountPercentage || null,
      gift_card_codes: giftCardSummary.codes,
      gift_card_total_used: giftCardSummary.totalUsed,
      gift_card_count: giftCardSummary.count,
      customer_email: orderData.customerEmail,
      customer_name: orderData.customerName,
      shipping_address: orderData.shippingAddress,
      shipping_method: orderData.shippingMethod,
      shipping_cost: orderData.shippingCost,
      line_items: orderData.lineItems,
      payment_method: orderData.paymentMethod,
      payment_status: orderData.paymentStatus,
      payment_intent_id: orderData.paymentIntentId
    };
    
    console.log('🔍 Insert data prepared:', {
      fid: insertData.fid,
      order_id: insertData.order_id,
      status: insertData.status,
      amount_total: insertData.amount_total,
      discount_code: insertData.discount_code,
      hasLineItems: !!insertData.line_items,
      lineItemsLength: insertData.line_items?.length
    });
    
    // Use admin client to bypass RLS for order creation
    const adminClient = supabaseAdmin || supabase;
    const { data: order, error } = await adminClient
      .from('orders')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Database insertion error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        insertData: insertData
      });
      return { success: false, error: error.message };
    }

    console.log('✅ Order created successfully:', order.order_id);

    // Create order items in the normalized table
    if (orderData.lineItems && orderData.lineItems.length > 0) {
      try {
        const orderItems = orderData.lineItems.map(item => ({
          order_id: order.id,
          product_id: item.id || 'unknown',
          product_handle: item.handle || null,
          product_title: item.title || 'Unknown Product',
          variant_id: item.variantId || item.id,
          variant_title: item.variant || 'Default Title',
          sku: item.sku || null,
          price: parseFloat(item.price) || 0,
          quantity: parseInt(item.quantity) || 1,
          total: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1),
          product_data: item
        }));

        const { error: itemsError } = await adminClient
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          // Don't fail the order creation, just log the error
        } else {
          console.log('✅ Order items created successfully');
        }
      } catch (itemsError) {
        console.error('Error processing order items:', itemsError);
        // Don't fail the order creation, just log the error
      }
    }

    // Note: Discount code usage is now tracked in the main order route (shopify/orders/route.js)
    // This ensures tracking happens even if Supabase order creation fails

    // Log gift card usage if gift cards were used in this order
    if (orderData.giftCards && Array.isArray(orderData.giftCards) && orderData.giftCards.length > 0) {
      try {
        console.log('🎁 Recording gift card usage for order:', order.order_id);
        
        for (const giftCard of orderData.giftCards) {
          if (giftCard.code && giftCard.amountUsed > 0) {
            // First, try to get the gift card ID from our database
            let giftCardId = null;
            const { data: giftCardData, error: giftCardError } = await supabaseAdmin
              .from('gift_cards')
              .select('id')
              .eq('code', giftCard.code.toUpperCase())
              .single();
            
            if (!giftCardError && giftCardData) {
              giftCardId = giftCardData.id;
            }
            
            // Record gift card usage
            const { error: usageError } = await supabaseAdmin
              .from('gift_card_usage')
              .insert({
                gift_card_id: giftCardId, // May be null if gift card not in our database
                order_id: order.order_id,
                amount_used: parseFloat(giftCard.amountUsed),
                balance_after: parseFloat(giftCard.balanceAfter || 0),
                fid: orderData.fid
              });
            
            if (usageError) {
              console.error('❌ Error recording gift card usage:', usageError);
            } else {
              console.log('✅ Gift card usage recorded:', {
                code: giftCard.code,
                amountUsed: giftCard.amountUsed,
                orderId: order.order_id
              });
            }
          }
        }
      } catch (giftCardError) {
        console.error('❌ Error processing gift card usage:', giftCardError);
        // Don't fail the order creation, just log the error
      }
    }

    // Add purchase points for the user (automatic points system)
    if (orderData.fid && orderData.amountTotal && orderData.status === 'paid') {
      try {
        const { addPurchasePoints } = await import('./points.js');
        const pointsResult = await addPurchasePoints(
          orderData.fid,
          parseFloat(orderData.amountTotal),
          order.order_id
        );
        
        if (pointsResult.success) {
          console.log('✅ Purchase points added automatically:', {
            orderId: order.order_id,
            userFid: orderData.fid,
            amountTotal: orderData.amountTotal,
            pointsEarned: pointsResult.pointsEarned,
            totalPoints: pointsResult.totalPoints
          });
        } else {
          console.error('❌ Failed to add purchase points:', pointsResult.error);
        }
      } catch (pointsError) {
        console.error('❌ Error adding purchase points:', pointsError);
        // Don't fail the order creation, just log the error
      }
    } else {
      console.log('ℹ️ Skipping automatic purchase points:', {
        hasFid: !!orderData.fid,
        hasAmountTotal: !!orderData.amountTotal,
        status: orderData.status,
        reason: 'Missing FID, amount, or order not paid'
      });
    }

    return { success: true, order };

  } catch (error) {
    console.error('Error in createOrder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update order status and send appropriate notifications
 */
export async function updateOrderStatus(orderId, newStatus, additionalData = {}) {
  try {
    console.log(`Updating order ${orderId} status to ${newStatus}`);

    // Prepare update data
    const updateData = {
      status: newStatus,
      ...additionalData
    };

    // Add timestamp for specific status changes
    if (newStatus === 'shipped') {
      updateData.shipped_at = new Date().toISOString();
    } else if (newStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    // Update the order - use admin client for system operations (webhooks)
    const adminClient = supabaseAdmin || supabase;
    const { data: order, error } = await adminClient
      .from('orders')
      .update(updateData)
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order status:', error);
      return { success: false, error: error.message };
    }

    console.log('Order status updated successfully:', order);

    // Send appropriate notifications based on status
    if (newStatus === 'paid' && !order.order_confirmation_sent) {
      await sendOrderConfirmationNotificationAndMark(order);
    } else if (newStatus === 'shipped' && !order.shipping_notification_sent) {
      await sendShippingNotificationAndMark(order);
    }

    // Add purchase points when order transitions to 'paid' status
    if (newStatus === 'paid' && order.fid && order.amount_total) {
      try {
        const { addPurchasePoints } = await import('./points.js');
        const pointsResult = await addPurchasePoints(
          order.fid,
          parseFloat(order.amount_total),
          order.order_id
        );
        
        if (pointsResult.success) {
          console.log('✅ Purchase points added on status update to paid:', {
            orderId: order.order_id,
            userFid: order.fid,
            amountTotal: order.amount_total,
            pointsEarned: pointsResult.pointsEarned,
            totalPoints: pointsResult.totalPoints
          });
        } else {
          console.error('❌ Failed to add purchase points on status update:', pointsResult.error);
        }
      } catch (pointsError) {
        console.error('❌ Error adding purchase points on status update:', pointsError);
        // Don't fail the status update, just log the error
      }
    }

    return { success: true, order };

  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send order confirmation notification and mark as sent
 */
export async function sendOrderConfirmationNotificationAndMark(order) {
  try {
    console.log('Sending order confirmation notification for order:', order.order_id);

    // Send notification via Neynar
    const notificationResult = await sendOrderConfirmationNotification(
      order.fid,
      {
        orderId: order.order_id,
        amount: order.amount_total,
        currency: order.currency,
        items: order.line_items
      }
    );

    if (notificationResult.success) {
      // Mark notification as sent - use admin client for system operations
      const adminClient = supabaseAdmin || supabase;
      const { error } = await adminClient
        .from('orders')
        .update({
          order_confirmation_sent: true,
          order_confirmation_sent_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) {
        console.error('Error marking order confirmation as sent:', error);
      } else {
        console.log('Order confirmation notification sent and marked');
      }
    }

    return notificationResult;

  } catch (error) {
    console.error('Error sending order confirmation notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send shipping notification and mark as sent
 */
export async function sendShippingNotificationAndMark(order) {
  try {
    console.log('Sending shipping notification for order:', order.order_id);

    // Send notification via Neynar
    const notificationResult = await sendShippingNotification(
      order.fid,
      {
        orderId: order.order_id,
        trackingNumber: order.tracking_number,
        trackingUrl: order.tracking_url,
        carrier: order.carrier
      }
    );

    if (notificationResult.success) {
      // Mark notification as sent - use admin client for system operations
      const adminClient = supabaseAdmin || supabase;
      const { error } = await adminClient
        .from('orders')
        .update({
          shipping_notification_sent: true,
          shipping_notification_sent_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) {
        console.error('Error marking shipping notification as sent:', error);
      } else {
        console.log('Shipping notification sent and marked');
      }
    }

    return notificationResult;

  } catch (error) {
    console.error('Error sending shipping notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add tracking information to an order
 */
export async function addTrackingInfo(orderId, trackingData) {
  try {
    console.log(`Adding tracking info to order ${orderId}:`, trackingData);

    // Use admin client for system operations (webhooks)
    const adminClient = supabaseAdmin || supabase;
    const { data: order, error } = await adminClient
      .from('orders')
      .update({
        tracking_number: trackingData.trackingNumber,
        tracking_url: trackingData.trackingUrl,
        carrier: trackingData.carrier,
        status: 'shipped',
        shipped_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error adding tracking info:', error);
      return { success: false, error: error.message };
    }

    // Send shipping notification if not already sent
    if (!order.shipping_notification_sent) {
      await sendShippingNotificationAndMark(order);
    }

    return { success: true, order };

  } catch (error) {
    console.error('Error in addTrackingInfo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel an order and update its status
 */
export async function cancelOrder(orderId, cancelReason = 'cancelled_in_shopify') {
  try {
    console.log(`Cancelling order ${orderId} with reason: ${cancelReason}`);

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'cancelled',
        archived_at: new Date().toISOString(),
        archived_in_shopify: cancelReason === 'cancelled_in_shopify'
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling order:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Order cancelled successfully:', order.order_id);
    return { success: true, order };

  } catch (error) {
    console.error('Error in cancelOrder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Archive an order instead of deleting it
 */
export async function archiveOrder(orderId, archiveReason = 'archived_in_shopify') {
  try {
    console.log(`Archiving order ${orderId} with reason: ${archiveReason}`);

    // Use admin client for system operations (webhooks)
    const adminClient = supabaseAdmin || supabase;
    const { data: order, error } = await adminClient
      .from('orders')
      .update({
        archived_at: new Date().toISOString(),
        archived_in_shopify: archiveReason === 'archived_in_shopify'
        // Note: We preserve the original status (shipped, delivered, etc.) when archiving
        // Archiving is separate from order status - archived orders keep their fulfillment status
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error archiving order:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Order archived successfully:', order.order_id);
    return { success: true, order };

  } catch (error) {
    console.error('Error in archiveOrder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get orders for a specific user (excluding archived by default)
 */
export async function getUserOrders(fid, limit = 50, includeArchived = false) {
  try {
    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('fid', fid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!includeArchived) {
      query = query.is('archived_at', null);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching user orders:', error);
      return { success: false, error: error.message };
    }

    return { success: true, orders };

  } catch (error) {
    console.error('Error in getUserOrders:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a specific order by order ID
 */
export async function getOrder(orderId) {
  try {
    // Use admin client for system operations (webhooks, etc.) that don't have user context
    const adminClient = supabaseAdmin || supabase;
    const { data: order, error } = await adminClient
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      return { success: false, error: error.message };
    }

    return { success: true, order };

  } catch (error) {
    console.error('Error in getOrder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get orders that need notifications sent
 */
export async function getOrdersNeedingNotifications() {
  try {
    // Get paid orders that haven't had confirmation sent
    const { data: confirmationNeeded, error: confirmError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'paid')
      .eq('order_confirmation_sent', false);

    if (confirmError) {
      console.error('Error fetching orders needing confirmation:', confirmError);
    }

    // Get shipped orders that haven't had shipping notification sent
    const { data: shippingNeeded, error: shippingError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'shipped')
      .eq('shipping_notification_sent', false);

    if (shippingError) {
      console.error('Error fetching orders needing shipping notification:', shippingError);
    }

    return {
      success: true,
      confirmationNeeded: confirmationNeeded || [],
      shippingNeeded: shippingNeeded || []
    };

  } catch (error) {
    console.error('Error in getOrdersNeedingNotifications:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get discount usage statistics
 */
export async function getDiscountUsageStats(fid = null) {
  try {
    console.log('Getting discount usage statistics for FID:', fid);

    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('discount_code, discount_amount, discount_percentage, amount_total, amount_subtotal, created_at, status');

    if (fid) {
      ordersQuery = ordersQuery.eq('fid', fid);
    }

    const { data: orders, error } = await ordersQuery
      .not('discount_code', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching discount usage stats:', error);
      return { success: false, error: error.message };
    }

    // Calculate statistics
    const stats = {
      totalOrdersWithDiscounts: orders.length,
      totalDiscountAmount: orders.reduce((sum, order) => sum + (parseFloat(order.discount_amount) || 0), 0),
      totalOrderValue: orders.reduce((sum, order) => sum + (parseFloat(order.amount_total) || 0), 0),
      totalOriginalValue: orders.reduce((sum, order) => sum + (parseFloat(order.amount_subtotal) || 0), 0),
      averageDiscountAmount: 0,
      averageDiscountPercentage: 0,
      discountCodeUsage: {},
      ordersByStatus: {}
    };

    if (orders.length > 0) {
      stats.averageDiscountAmount = stats.totalDiscountAmount / orders.length;
      
      // Calculate average discount percentage
      const percentageOrders = orders.filter(order => order.discount_percentage);
      if (percentageOrders.length > 0) {
        stats.averageDiscountPercentage = percentageOrders.reduce((sum, order) => 
          sum + parseFloat(order.discount_percentage), 0) / percentageOrders.length;
      }

      // Count discount code usage
      orders.forEach(order => {
        if (order.discount_code) {
          stats.discountCodeUsage[order.discount_code] = (stats.discountCodeUsage[order.discount_code] || 0) + 1;
        }
        
        stats.ordersByStatus[order.status] = (stats.ordersByStatus[order.status] || 0) + 1;
      });
    }

    console.log('Discount usage statistics:', stats);
    return { success: true, stats, orders };

  } catch (error) {
    console.error('Error in getDiscountUsageStats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user has used any discount codes
 */
export async function hasUserUsedDiscounts(fid) {
  try {
    console.log('Checking if user has used discount codes:', fid);

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('discount_code')
      .eq('fid', fid)
      .not('discount_code', 'is', null)
      .limit(1);

    if (error) {
      console.error('Error checking user discount usage:', error);
      return { success: false, error: error.message };
    }

    const hasUsedDiscounts = orders && orders.length > 0;
    console.log('User has used discounts:', hasUsedDiscounts);

    return { 
      success: true, 
      hasUsedDiscounts,
      discountOrdersCount: orders ? orders.length : 0
    };

  } catch (error) {
    console.error('Error in hasUserUsedDiscounts:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Prevent duplicate discount usage across multiple order attempts
 */
export async function checkDiscountUsageConflict(discountCode, excludeOrderId = null) {
  try {
    console.log('Checking for discount usage conflicts:', { discountCode, excludeOrderId });

    let query = supabaseAdmin
      .from('orders')
      .select('order_id, status, created_at, fid')
      .eq('discount_code', discountCode.toUpperCase());

    if (excludeOrderId) {
      query = query.neq('order_id', excludeOrderId);
    }

    const { data: conflictingOrders, error } = await query;

    if (error) {
      console.error('Error checking discount usage conflicts:', error);
      return { success: false, error: error.message };
    }

    const hasConflict = conflictingOrders && conflictingOrders.length > 0;
    
    if (hasConflict) {
      console.log('Discount usage conflict detected:', conflictingOrders);
    }

    return {
      success: true,
      hasConflict,
      conflictingOrders: conflictingOrders || []
    };

  } catch (error) {
    console.error('Error in checkDiscountUsageConflict:', error);
    return { success: false, error: error.message };
  }
} 