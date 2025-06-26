# Supabase Setup for Minted Merch

This document explains how to set up Supabase for the Minted Merch notification system, based on the working GameLink implementation.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note down your project URL and anon key

## 2. Environment Variables

Add these to your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 3. Database Schema

Run the SQL from `database/schema.sql` in your Supabase SQL editor:

1. Go to your Supabase dashboard
2. Click on "SQL Editor" 
3. Copy and paste the contents of `database/schema.sql`
4. Click "Run"

This will create:
- `profiles` table for user data
- `notification_tokens` table for notification permissions
- Proper indexes and RLS policies

## 4. How It Works

### When User Adds Mini App with Notifications:

1. **Webhook Event**: Farcaster sends `frame_added` event to our webhook
2. **Profile Creation**: We create/update user profile in `profiles` table
3. **Token Storage**: We store notification token in `notification_tokens` table
4. **Welcome Notification**: We send welcome notification using stored token

### When User Removes Mini App:

1. **Webhook Event**: Farcaster sends `frame_removed` event
2. **Token Deactivation**: We mark notification token as inactive

### When Sending Notifications:

1. **Token Lookup**: We query `notification_tokens` for active tokens
2. **Send via Neynar**: We use Neynar API to send notifications
3. **User Receives**: User gets notification in their Farcaster client

## 5. Key Differences from Previous Approach

### ❌ Before (Not Working):
- No database to store notification tokens
- Trying to send notifications without knowing user permissions
- No way to track who has enabled notifications

### ✅ Now (Working like GameLink):
- Database stores notification tokens and user profiles
- Webhook properly handles token storage/removal
- Notifications sent only to users with active tokens

## 6. Testing

After setup, test the notification system:

1. Add the Mini App with notifications enabled
2. Check Supabase tables to see if data is stored
3. Verify welcome notification is received
4. Remove the Mini App and check token is deactivated

## 7. Troubleshooting

### Common Issues:

1. **Environment Variables**: Make sure Supabase URL and key are correct
2. **Database Permissions**: Ensure RLS policies are set up correctly
3. **Webhook Events**: Check Vercel logs to see if webhook events are received
4. **Token Storage**: Verify tokens are being stored in `notification_tokens` table

### Debug Steps:

1. Check Supabase logs for database errors
2. Check Vercel function logs for webhook processing
3. Verify Neynar API responses
4. Test with manual API calls to debug each step 