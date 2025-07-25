export async function GET() {
  try {
    const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
    const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

    // First, just check if we have credentials
    const hasCredentials = {
      domain: !!SHOPIFY_DOMAIN,
      token: !!SHOPIFY_ADMIN_ACCESS_TOKEN,
      webhookSecret: !!SHOPIFY_WEBHOOK_SECRET,
      domainValue: SHOPIFY_DOMAIN ? `${SHOPIFY_DOMAIN.substring(0, 10)}...` : 'not set',
      tokenValue: SHOPIFY_ADMIN_ACCESS_TOKEN ? `${SHOPIFY_ADMIN_ACCESS_TOKEN.substring(0, 10)}...` : 'not set'
    };

    if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
      return Response.json({
        error: 'Shopify credentials not configured',
        hasCredentials
      }, { status: 500 });
    }

    console.log('Attempting to fetch webhook configuration from Shopify...');

    try {
      const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/webhooks.json`, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN
        }
      });

      const result = await response.json();

      if (!response.ok) {
        return Response.json({
          success: false,
          error: 'Failed to fetch webhooks from Shopify',
          details: result,
          shopifyResponse: response.status,
          hasCredentials
        }, { status: response.status });
      }

      const fulfillmentWebhooks = result.webhooks.filter(w => 
        w.topic === 'fulfillments/create' || 
        w.topic === 'fulfillments/update' ||
        w.topic === 'orders/fulfilled'
      );

      return Response.json({
        success: true,
        totalWebhooks: result.webhooks.length,
        fulfillmentWebhooks: fulfillmentWebhooks,
        allWebhooks: result.webhooks.map(w => ({
          id: w.id,
          topic: w.topic,
          address: w.address,
          created_at: w.created_at,
          updated_at: w.updated_at
        })),
        config: {
          expectedAddress: 'https://mintedmerch.vercel.app/api/shopify/fulfillment-webhook',
          hasWebhookSecret: !!SHOPIFY_WEBHOOK_SECRET,
          shopifyDomain: SHOPIFY_DOMAIN
        },
        hasCredentials
      });

    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return Response.json({
        success: false,
        error: 'Network error fetching from Shopify',
        fetchError: fetchError.message,
        hasCredentials
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error checking webhook status:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 