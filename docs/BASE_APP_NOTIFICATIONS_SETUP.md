# Base App Notifications Setup

## Overview

**Base app and Farcaster/Warpcast use SEPARATE notification systems.** This document explains how to support both.

## Current Issue

You're receiving Base app notifications ✅ but NOT Farcaster notifications ❌.

### Why This Happened

1. When you unsaved/resaved the mini app in the Base app, it triggered a `miniapp_removed` event
2. Your database's `has_notifications` field may have been affected
3. **Important**: Base app and Farcaster notifications are completely independent
   - Base app: Uses `notification_token` and `url` from webhook events
   - Farcaster/Warpcast: Uses Neynar's managed system (automatic)

## Solution

### Immediate Fix (For You)

**You need to re-enable notifications in BOTH apps:**

1. **Farcaster/Warpcast**:
   - Open your mini app in Warpcast
   - Find notification settings or re-add the mini app
   - Enable notifications when prompted

2. **Base app**:
   - You're already receiving these ✅
   - No action needed

### Technical Implementation (Already Done)

I've updated your system to properly handle both notification systems:

#### 1. **Webhook Handler** (`/src/app/api/webhook/route.js`)
- Now detects Base app events vs Farcaster events
- Stores Base app tokens separately
- Doesn't interfere with Neynar's Farcaster token management

#### 2. **Database Schema** (`/database/migrations/add_base_app_notifications.sql`)
- New table: `base_app_notification_tokens` (for Base app)
- New column: `profiles.has_base_notifications` (separate from `has_notifications`)
- `has_notifications` = Farcaster/Warpcast notifications
- `has_base_notifications` = Base app notifications

## Database Migration

**Run this migration:**

```sql
-- From the migration file
psql -d your_database < database/migrations/add_base_app_notifications.sql
```

Or run it via Supabase dashboard:
1. Go to Supabase > SQL Editor
2. Copy contents of `database/migrations/add_base_app_notifications.sql`
3. Run the migration

## How Notifications Now Work

### **Farcaster/Warpcast** (Neynar Managed)
- ✅ Neynar handles everything automatically
- ✅ Your webhook receives events but doesn't need to process them
- ✅ Use `sendNotificationWithNeynar()` to send (already working)
- ✅ Check status with `hasNotificationTokenInNeynar(fid)`

### **Base App** (Direct Integration)
- ✅ Your webhook receives and stores tokens
- ✅ Stored in `base_app_notification_tokens` table
- 🔨 **TODO**: Create helper function to send Base app notifications
- 🔨 **TODO**: Update notification sending code to send to BOTH platforms

## Next Steps (TODO)

1. ✅ Run the database migration
2. ✅ Deploy the updated webhook handler
3. ⚠️ **Create Base app notification sending helper**
4. ⚠️ **Update order/shipping notification code to send to both platforms**
5. ⚠️ **Test in both Base app and Warpcast**

## Testing

### Test Farcaster Notifications
```javascript
// Test sending via Neynar
const result = await sendNotificationWithNeynar(your_fid, {
  title: 'Test from Farcaster',
  body: 'Testing Farcaster notifications',
  targetUrl: 'https://app.mintedmerch.shop'
});
console.log('Farcaster result:', result);
```

### Test Base App Notifications (After implementing helper)
```javascript
// TODO: Implement sendBaseAppNotification()
const result = await sendBaseAppNotification(your_fid, {
  title: 'Test from Base',
  body: 'Testing Base app notifications',
  targetUrl: 'https://app.mintedmerch.shop'
});
console.log('Base app result:', result);
```

## Important Notes

- **Two separate systems**: Base app ≠ Farcaster
- **Independent opt-ins**: Users must enable notifications in each app separately
- **Your current issue**: You opted out of Farcaster when unsaving mini app in Base
- **Solution**: Re-enable in Warpcast

## Resources

- [Base App Notifications Documentation](https://docs.base.org/mini-apps/core-concepts/notifications)
- Neynar API: Already integrated and working
- Your webhook: `https://app.mintedmerch.shop/api/webhook`
- Neynar webhook: `https://api.neynar.com/f/app/11f2fe11-b70c-40fa-b653-9770b7588bdf/event`

