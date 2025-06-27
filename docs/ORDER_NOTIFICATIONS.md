# Order Notifications System

This document describes the order notification system for Minted Merch, which automatically sends notifications to users when their orders are confirmed, shipped, and delivered.

## Overview

The order notification system consists of:
1. **Database**: Supabase tables for tracking orders and notification status
2. **Order Management**: Functions for creating, updating, and tracking orders
3. **Notification System**: Integration with Neynar for sending notifications
4. **API Endpoints**: For managing orders and triggering notifications

## Database Schema

### Orders Table
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  fid INTEGER NOT NULL REFERENCES profiles(fid),
  order_id TEXT UNIQUE NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  currency TEXT NOT NULL DEFAULT 'USDC',
  amount_total DECIMAL(10,2) NOT NULL,
  amount_subtotal DECIMAL(10,2),
  amount_tax DECIMAL(10,2),
  amount_shipping DECIMAL(10,2),
  customer_email TEXT,
  customer_name TEXT,
  shipping_address JSONB,
  shipping_method TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  carrier TEXT,
  line_items JSONB NOT NULL,
  payment_method TEXT,
  payment_status TEXT,
  payment_intent_id TEXT,
  order_confirmation_sent BOOLEAN DEFAULT FALSE,
  order_confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  shipping_notification_sent BOOLEAN DEFAULT FALSE,
  shipping_notification_sent_at TIMESTAMP WITH TIME ZONE,
  delivery_notification_sent BOOLEAN DEFAULT FALSE,
  delivery_notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);
```

### Order Status Flow
1. `pending` - Order created but payment not confirmed
2. `paid` - Payment confirmed, order confirmation notification sent
3. `processing` - Order being prepared for shipment
4. `shipped` - Order shipped, shipping notification sent
5. `delivered` - Order delivered (optional)
6. `cancelled` - Order cancelled
7. `refunded` - Order refunded

## API Endpoints

### Order Management
- `POST /api/orders/create` - Create a new order
- `POST /api/orders/update-status` - Update order status and trigger notifications
- `POST /api/orders/add-tracking` - Add tracking information and send shipping notification

### Shopify Integration
- `POST /api/shopify/fulfillment-webhook` - Webhook for Shopify fulfillment events
- `POST /api/orders/sync-shopify-fulfillment` - Manually sync Shopify fulfillment with notifications

### Debug/Testing
- `GET /api/debug/orders-test` - Comprehensive order system testing

## Notification Types

### 1. Order Confirmation Notification
**Trigger**: When order status changes to `paid`
**Content**: 
- Title: "📦 Order Confirmed!"
- Body: "Your order #{orderId} has been confirmed. Total: {amount} {currency}"
- Target URL: Main app URL

### 2. Shipping Notification
**Trigger**: When order status changes to `shipped` or tracking info is added
**Content**:
- Title: "🚚 Your Order Has Shipped!"
- Body: "Order #{orderId} is on its way! Track: {trackingNumber}"
- Target URL: Tracking URL or main app URL

### 3. Delivery Notification (Optional)
**Trigger**: When order status changes to `delivered`
**Content**:
- Title: "📦 Order Delivered!"
- Body: "Your order #{orderId} has been delivered!"
- Target URL: Main app URL

## Integration Points

### 1. Payment Verification
When a payment is verified in `/api/verify-payment/route.js`, the system:
1. Creates a Shopify order
2. Creates a corresponding Supabase order with status `paid`
3. Automatically sends order confirmation notification

### 2. Order Session
The order session (`/api/order-session/route.js`) now includes the user's FID for notification purposes.

### 3. Shopify Integration
Orders created in Shopify can be synchronized with Supabase for notification tracking.

**Automatic Sync via Webhooks**:
- Configure Shopify fulfillment webhooks to point to `/api/shopify/fulfillment-webhook`
- When you fulfill orders in Shopify, tracking info automatically syncs to Supabase
- Shipping notifications are sent automatically when fulfillments are created

**Manual Sync**:
- Use `/api/orders/sync-shopify-fulfillment` to manually sync fulfillment data
- Updates both Shopify fulfillment and Supabase tracking
- Sends shipping notifications to users

## Usage Examples

### Creating an Order
```javascript
import { createOrder } from '@/lib/orders';

const orderData = {
  fid: 3621,
  orderId: 'MM-001',
  sessionId: 'session-123',
  status: 'paid',
  currency: 'USDC',
  amountTotal: 29.99,
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  lineItems: [
    {
      id: 'product-1',
      title: 'Test Product',
      quantity: 1,
      price: 29.99
    }
  ],
  paymentMethod: 'USDC',
  paymentStatus: 'completed'
};

const result = await createOrder(orderData);
```

### Updating Order Status
```javascript
import { updateOrderStatus } from '@/lib/orders';

// Mark order as shipped and send notification
const result = await updateOrderStatus('MM-001', 'shipped', {
  trackingNumber: 'TRACK123',
  trackingUrl: 'https://tracking.example.com/TRACK123',
  carrier: 'UPS'
});
```

### Adding Tracking Information
```javascript
import { addTrackingInfo } from '@/lib/orders';

const result = await addTrackingInfo('MM-001', {
  trackingNumber: 'TRACK123',
  trackingUrl: 'https://tracking.example.com/TRACK123',
  carrier: 'UPS'
});
```

### Shopify Fulfillment Sync
```bash
# Manually sync Shopify fulfillment with notifications
curl -X POST "/api/orders/sync-shopify-fulfillment" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "MM-001",
    "trackingNumber": "1Z999AA1234567890",
    "trackingCompany": "UPS",
    "trackingUrl": "https://www.ups.com/track?tracknum=1Z999AA1234567890"
  }'
```

## Testing

### Running Tests
```bash
# Test the complete order system
curl "https://your-app.vercel.app/api/debug/orders-test?fid=3621"
```

### Test Flow
1. ✅ Supabase connection
2. ✅ Orders table exists
3. ✅ Notification status check
4. ✅ Create order
5. ✅ Update order status (triggers notification)
6. ✅ Add tracking info (triggers shipping notification)
7. ✅ Get user orders
8. ✅ Cleanup test data

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Neynar (for notifications)
NEYNAR_API_KEY=your_neynar_api_key
NEYNAR_CLIENT_ID=your_neynar_client_id
```

## Deployment Steps

1. **Update Database Schema**
   ```sql
   -- Run the SQL from database/schema.sql in your Supabase SQL editor
   ```

2. **Deploy Code**
   ```bash
   # Deploy to Vercel
   vercel --prod
   ```

3. **Test System**
   ```bash
   # Test order system
   curl "https://your-app.vercel.app/api/debug/orders-test?fid=YOUR_FID"
   ```

## Monitoring

### Order Status Tracking
- Monitor order creation success rate
- Track notification delivery rates
- Monitor order status progression

### Notification Metrics
- Order confirmation notification success rate
- Shipping notification success rate
- User engagement with notifications

## Troubleshooting

### Common Issues

1. **Orders not being created in Supabase**
   - Check RLS policies
   - Verify environment variables
   - Check order session includes FID

2. **Notifications not being sent**
   - Verify user has enabled notifications
   - Check Neynar API key
   - Verify notification token status

3. **Order status not updating**
   - Check database permissions
   - Verify order ID format
   - Check function parameters

### Debug Endpoints
- `/api/debug/orders-test` - Complete system test
- `/api/debug/supabase-test` - Supabase connectivity test
- `/api/debug/neynar-test` - Notification system test

## Future Enhancements

1. **Delivery Tracking**
   - Automatic delivery status updates
   - Delivery confirmation notifications

2. **Order History**
   - User order history page
   - Order status tracking page

3. **Advanced Notifications**
   - Customizable notification preferences
   - Rich notification content with images

4. **Analytics**
   - Order completion rates
   - Notification engagement metrics
   - Customer satisfaction tracking 