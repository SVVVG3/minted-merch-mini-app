import { supabase } from './supabase';
import { sendOrderConfirmationNotification, sendShippingNotification } from './neynar';

/**
 * Create a new order in the database
 */
export async function createOrder(orderData) {
  try {
    console.log('Creating order in database:', orderData);

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

    console.log('Order created successfully:', order);
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
 * Get orders for a specific user
 */
export async function getUserOrders(fid, limit = 50) {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('fid', fid)
      .order('created_at', { ascending: false })
      .limit(limit);

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