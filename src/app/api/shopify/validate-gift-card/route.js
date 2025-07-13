import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { code, customerEmail } = await request.json();

    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Gift card code is required' 
      }, { status: 400 });
    }

    console.log('🎁 Validating gift card code:', code);

    // Clean the code - remove spaces and convert to uppercase
    const cleanCode = code.replace(/\s+/g, '').toUpperCase();
    
    // Use Shopify REST API to validate gift card
    const shopDomain = process.env.SHOPIFY_SITE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    
    if (!shopDomain || !accessToken) {
      console.error('Missing Shopify credentials');
      return NextResponse.json({ 
        success: false, 
        error: 'Gift card validation unavailable' 
      }, { status: 500 });
    }
    
    const url = `https://${shopDomain}/admin/api/2024-10/gift_cards.json?code=${cleanCode}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Shopify REST API error:', response.status, response.statusText);
      return NextResponse.json({ 
        success: false, 
        error: 'Gift card not found or invalid code' 
      }, { status: 400 });
    }
    
    const data = await response.json();
    
    if (!data.gift_cards || data.gift_cards.length === 0) {
      console.log('Gift card not found in Shopify');
      return NextResponse.json({ 
        success: false, 
        error: 'Gift card not found or invalid code' 
      }, { status: 400 });
    }
    
    const giftCard = data.gift_cards[0];
    
    // Check if gift card is enabled
    if (giftCard.disabled_at !== null) {
      return NextResponse.json({ 
        success: false, 
        error: 'Gift card is disabled' 
      }, { status: 400 });
    }
    
    // Check if gift card has expired
    if (giftCard.expires_on && new Date(giftCard.expires_on) < new Date()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Gift card has expired' 
      }, { status: 400 });
    }

    // Check if gift card has balance
    const balance = parseFloat(giftCard.balance);
    if (balance <= 0) {
      return NextResponse.json({
        success: false,
        error: 'This gift card has no remaining balance'
      }, { status: 400 });
    }

    console.log('✅ Gift card validation successful:', {
      code: giftCard.code,
      balance: balance,
      lastCharacters: giftCard.last_characters
    });

    return NextResponse.json({
      success: true,
      isValid: true,
      isGiftCard: true,
      balance: balance,
      currency: giftCard.currency,
      code: giftCard.code,
      lastCharacters: giftCard.last_characters,
      initialValue: parseFloat(giftCard.initial_value),
      expiresOn: giftCard.expires_on,
      message: `Gift card has $${balance} remaining balance`
    });

  } catch (error) {
    console.error('❌ Error validating gift card:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to validate gift card code',
      details: error.message
    }, { status: 500 });
  }
}

// Handle GET requests for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const customerEmail = searchParams.get('email');
  
  if (!code) {
    return NextResponse.json({
      message: 'Gift card validation endpoint',
      usage: 'POST with { code, customerEmail } or GET with ?code=CODE&email=EMAIL',
      note: 'customerEmail is optional',
      example: {
        code: 'GIFTCARDCODE123',
        customerEmail: 'customer@example.com'
      },
      timestamp: new Date().toISOString()
    });
  }

  // For GET requests, validate the provided code
  try {
    const body = JSON.stringify({ code, customerEmail });
    const response = await POST(new Request(request.url, { 
      method: 'POST', 
      body,
      headers: { 'Content-Type': 'application/json' }
    }));
    
    return response;
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to validate gift card code',
      details: error.message
    });
  }
} 