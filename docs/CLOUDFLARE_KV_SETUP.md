# Cloudflare KV Setup Guide

## Quick Setup

1. **Create a Cloudflare Account**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Sign up or log in

2. **Create a KV Namespace**
   - Navigate to **Workers & Pages** → **KV**
   - Click **Create namespace**
   - Name it `shopify-mini-app` (or any name you prefer)
   - Click **Add**

3. **Get Your Credentials**
   - **Account ID**: Found in the right sidebar of your Cloudflare dashboard
   - **Namespace ID**: Click on your KV namespace to see its ID
   - **API Token**: 
     - Go to **My Profile** → **API Tokens**
     - Click **Create Token**
     - Use template "Edit Cloudflare Workers"
     - Or create custom token with:
       - Account: Workers KV Storage:Edit
       - Zone: Zone:Read (optional)
     - Click **Continue to summary** → **Create Token**

4. **Add to Your .env.local**
   ```
   CLOUDFLARE_ACCOUNT_ID=your-account-id
   CLOUDFLARE_KV_NAMESPACE_ID=your-namespace-id
   CLOUDFLARE_KV_API_TOKEN=your-api-token
   ```

## Testing Your Setup

Run your development server and the KV operations should work seamlessly!

## API Limits

- Free tier: 100,000 reads/day, 1,000 writes/day
- Key size: up to 512 bytes
- Value size: up to 25 MB
- Expiration: supported via TTL

## Troubleshooting

If you get authentication errors:
- Ensure your API token has the correct permissions
- Check that your Account ID and Namespace ID are correct
- Make sure there are no extra spaces in your environment variables