import { NextResponse } from 'next/server';

const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

export async function POST() {
  try {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
      return NextResponse.json({
        error: 'Shopify credentials not configured'
      }, { status: 500 });
    }

    // Create multiple order-related webhooks
    const webhooks = [
      {
        topic: 'orders/create',
        address: 'https://mintedmerch.vercel.app/api/shopify/order-webhook',
        format: 'json'
      },
      {
        topic: 'orders/updated',
        address: 'https://mintedmerch.vercel.app/api/shopify/order-webhook',
        format: 'json'
      },
      {
        topic: 'orders/cancelled',
        address: 'https://mintedmerch.vercel.app/api/shopify/order-webhook',
        format: 'json'
      },
      {
        topic: 'orders/paid',
        address: 'https://mintedmerch.vercel.app/api/shopify/order-webhook',
        format: 'json'
      }
    ];

    const results = [];

    for (const webhookConfig of webhooks) {
      console.log(`Creating ${webhookConfig.topic} webhook in Shopify...`);

      const webhookData = {
        webhook: webhookConfig
      };

      const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN
        },
        body: JSON.stringify(webhookData)
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`Failed to create ${webhookConfig.topic} webhook:`, result);
        results.push({
          topic: webhookConfig.topic,
          success: false,
          error: result,
          status: response.status
        });
      } else {
        console.log(`✅ ${webhookConfig.topic} webhook created successfully:`, result.webhook);
        results.push({
          topic: webhookConfig.topic,
          success: true,
          webhook: result.webhook
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return NextResponse.json({
      success: successCount === totalCount,
      message: `${successCount}/${totalCount} webhooks created successfully`,
      results: results,
      summary: {
        created: successCount,
        failed: totalCount - successCount,
        total: totalCount
      }
    });

  } catch (error) {
    console.error('❌ Error creating order webhooks:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ADMIN_ACCESS_TOKEN) {
      return NextResponse.json({
        error: 'Shopify credentials not configured'
      }, { status: 500 });
    }

    console.log('Fetching existing order webhooks from Shopify...');

    const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/webhooks.json`, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN
      }
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch webhooks',
        details: result
      }, { status: response.status });
    }

    const orderWebhooks = result.webhooks.filter(w => 
      w.topic === 'orders/create' ||
      w.topic === 'orders/updated' || 
      w.topic === 'orders/cancelled' ||
      w.topic === 'orders/paid'
    );

    return NextResponse.json({
      success: true,
      webhooks: result.webhooks,
      orderWebhooks: orderWebhooks,
      summary: {
        total: result.webhooks.length,
        orderRelated: orderWebhooks.length,
        topics: orderWebhooks.map(w => w.topic)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching order webhooks:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 