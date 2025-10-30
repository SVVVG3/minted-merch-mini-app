# Neynar Webhook Setup Guide

## Problem
Your Mini App manifest correctly points to Neynar's webhook URL (`https://api.neynar.com/f/app/<your_client_id>/event`), which means Neynar receives all Mini App events from Farcaster. However, **Neynar needs to be configured to forward these events to your app's webhook endpoint**.

## Solution
You need to set up webhook forwarding in the Neynar Developer Portal so that Mini App events are forwarded to your app.

## Step 1: Access Neynar Developer Portal

1. Go to [dev.neynar.com](https://dev.neynar.com)
2. Sign in with your account
3. Navigate to your Mini App project

## Step 2: Configure Webhook Forwarding

1. **Find the Webhooks Section**: Look for a "Webhooks" tab or section in your app dashboard
2. **Create New Webhook**: Click "New Webhook" or "Add Webhook"
3. **Configure Webhook Settings**:
   - **Target URL**: `https://your-domain.com/api/webhook`
   - **Events**: Select Mini App events:
     - `frame_added` - When user adds your Mini App
     - `notifications_enabled` - When user enables notifications
     - `notifications_disabled` - When user disables notifications  
     - `frame_removed` - When user removes your Mini App
   - **Secret**: Generate or provide a webhook secret for verification

## Step 3: Update Environment Variables

Add the webhook secret to your `.env.local` file:

```env
NEYNAR_WEBHOOK_SECRET=your_webhook_secret_here
```

## Step 4: Verify Webhook Setup

1. **Test Webhook Endpoint**: Visit `https://your-domain.com/api/webhook` to ensure it's accessible
2. **Check Webhook Signature**: Your webhook handler should verify incoming requests from Neynar
3. **Test Mini App Add**: Try adding your Mini App with notifications enabled to test the flow

## Expected Webhook Payload

When Neynar forwards events, you should receive payloads like this:

### Frame Added with Notifications
```json
{
  "event": "frame_added",
  "untrustedData": {
    "fid": 12345
  },
  "notificationDetails": {
    "token": "notification_token_here",
    "url": "https://api.neynar.com/f/app/your_client_id/event"
  }
}
```

### Notifications Enabled
```json
{
  "event": "notifications_enabled", 
  "untrustedData": {
    "fid": 12345
  },
  "notificationDetails": {
    "token": "notification_token_here",
    "url": "https://api.neynar.com/f/app/your_client_id/event"
  }
}
```

## Step 5: Test the Complete Flow

1. **Add Mini App**: Go to your Mini App and use the "Add Mini App" button
2. **Enable Notifications**: Make sure to enable notifications during the add process
3. **Check Logs**: Monitor your webhook endpoint logs for incoming events
4. **Verify Notification**: Confirm you receive the welcome notification

## Troubleshooting

### No Webhook Events Received
- Verify your webhook URL is publicly accessible
- Check that webhook forwarding is properly configured in Neynar portal
- Ensure your Mini App manifest has the correct Neynar webhook URL

### Webhook Signature Verification Fails
- Make sure `NEYNAR_WEBHOOK_SECRET` matches the secret in Neynar portal
- Verify you're using the correct HMAC algorithm (sha512)

### Welcome Notifications Not Sent
- Check that `sendWelcomeNotification()` function works correctly
- Verify user has valid notification tokens in Neynar
- Check notification API rate limits

## Alternative Solution (If Webhook Forwarding Unavailable)

If Neynar doesn't support webhook forwarding yet, you can implement a polling solution:

1. **Periodic Check**: Set up a cron job to check for new notification tokens
2. **Token Comparison**: Compare current tokens with previously stored tokens
3. **Send Welcome**: Send welcome notifications for newly detected tokens

This approach is less efficient but works as a fallback until webhook forwarding is available. 