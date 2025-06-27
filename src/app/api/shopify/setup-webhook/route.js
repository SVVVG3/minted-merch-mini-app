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

    const webhookData = {
      webhook: {
        topic: 'fulfillments/create',
        address: 'https://mintedmerch.vercel.app/api/shopify/fulfillment-webhook',
        format: 'json'
      }
    };

    console.log('Creating fulfillment webhook in Shopify...');

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
      console.error('Failed to create webhook:', result);
      return NextResponse.json({
        success: false,
        error: 'Failed to create webhook',
        details: result
      }, { status: response.status });
    }

    console.log('✅ Fulfillment webhook created successfully:', result.webhook);

    return NextResponse.json({
      success: true,
      webhook: result.webhook,
      message: 'Fulfillment webhook created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating webhook:', error);
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

    console.log('Fetching existing webhooks from Shopify...');

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

    return NextResponse.json({
      success: true,
      webhooks: result.webhooks,
      fulfillmentWebhooks: result.webhooks.filter(w => w.topic === 'fulfillments/create')
    });

  } catch (error) {
    console.error('❌ Error fetching webhooks:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 