import { supabase } from './supabase';
import { sendOrderConfirmationNotification, sendShippingNotification } from './neynar';
import { markDiscountCodeAsUsed, validateDiscountCode } from './discounts';

/**
 * Validate discount code before order creation
 */
export async function validateDiscountForOrder(discountCode, fid, subtotal) {
  try {
    if (!discountCode) {
      return { success: true, isValid: false }; // No discount code provided
    }

    console.log('Validating discount code for order creation:', { discountCode, fid, subtotal });

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
    const { data: discountCodeData, error: fetchError } = await supabase
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
    console.log('Creating order in database:', orderData);

    // Validate discount code if provided (final validation before order creation)
    if (orderData.discountCode) {
      const discountValidation = await validateDiscountForOrder(
        orderData.discountCode, 
        orderData.fid, 
        orderData.amountSubtotal
      );

      if (!discountValidation.success || !discountValidation.isValid) {
        console.error('Discount validation failed during order creation:', discountValidation.error);
        return { 
          success: false, 
          error: discountValidation.error || 'Invalid discount code',
          errorType: 'DISCOUNT_VALIDATION_FAILED'
        };
      }
    }

    // Create the order
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
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
        customer_email: orderData.customerEmail,
        customer_name: orderData.customerName,
        shipping_address: orderData.shippingAddress,
        shipping_method: orderData.shippingMethod,
        shipping_cost: orderData.shippingCost,
        line_items: orderData.lineItems,
        payment_method: orderData.paymentMethod,
        payment_status: orderData.paymentStatus,
        payment_intent_id: orderData.paymentIntentId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
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

        const { error: itemsError } = await supabase
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

    // Mark discount code as used if provided
    if (orderData.discountCode) {
      try {
        const markUsedResult = await markDiscountCodeAsUsed(
          orderData.discountCode, 
          order.order_id,
          orderData.fid,
          orderData.discountAmount || 0,
          orderData.amountSubtotal || 0
        );
        if (markUsedResult.success) {
          console.log('✅ Discount code marked as used:', orderData.discountCode);
        } else {
          console.error('❌ Failed to mark discount code as used:', markUsedResult.error);
        }
      } catch (discountError) {
        console.error('❌ Error marking discount code as used:', discountError);
      }
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

    // Update the order
    const { data: order, error } = await supabase
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
      // Mark notification as sent
      const { error } = await supabase
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
      // Mark notification as sent
      const { error } = await supabase
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

    const { data: order, error } = await supabase
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

    const { data: order, error } = await supabase
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

    const { data: order, error } = await supabase
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
    let query = supabase
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
    const { data: order, error } = await supabase
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
    const { data: confirmationNeeded, error: confirmError } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'paid')
      .eq('order_confirmation_sent', false);

    if (confirmError) {
      console.error('Error fetching orders needing confirmation:', confirmError);
    }

    // Get shipped orders that haven't had shipping notification sent
    const { data: shippingNeeded, error: shippingError } = await supabase
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

    let ordersQuery = supabase
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

    const { data: orders, error } = await supabase
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

    let query = supabase
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