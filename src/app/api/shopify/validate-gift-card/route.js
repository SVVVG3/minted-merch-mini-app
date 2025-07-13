import { NextResponse } from 'next/server';
import { shopifyAdminFetch } from '@/lib/shopifyAdmin';

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

    // Query Shopify for gift card information
    const query = `
      query getGiftCard($code: String!) {
        giftCard(id: "gid://shopify/GiftCard/\${code}") {
          id
          code
          balance {
            amount
            currencyCode
          }
          initialValue {
            amount
            currencyCode
          }
          enabled
          expiresOn
          lastCharacters
          order {
            id
            name
          }
          customer {
            email
            firstName
            lastName
          }
          createdAt
          updatedAt
        }
      }
    `;

    // Alternative query if direct ID doesn't work - search by code
    const searchQuery = `
      query searchGiftCardsByCode($query: String!) {
        giftCards(first: 5, query: $query) {
          edges {
            node {
              id
              code
              balance {
                amount
                currencyCode
              }
              initialValue {
                amount
                currencyCode
              }
              enabled
              expiresOn
              lastCharacters
              order {
                id
                name
              }
              customer {
                email
                firstName
                lastName
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    let giftCardData = null;
    
    try {
      // First try direct lookup
      const directResult = await shopifyAdminFetch(query, { code });
      giftCardData = directResult.data?.giftCard;
    } catch (error) {
      console.log('Direct lookup failed, trying search:', error.message);
    }

    // If direct lookup failed, try search
    if (!giftCardData) {
      try {
        const searchResult = await shopifyAdminFetch(searchQuery, { 
          query: `code:${code}` 
        });
        
        const giftCards = searchResult.data?.giftCards?.edges || [];
        if (giftCards.length > 0) {
          giftCardData = giftCards[0].node;
        }
      } catch (error) {
        console.log('Search lookup also failed:', error.message);
      }
    }

    if (!giftCardData) {
      return NextResponse.json({
        success: false,
        error: 'Gift card not found or invalid code'
      }, { status: 404 });
    }

    // Check if gift card is enabled
    if (!giftCardData.enabled) {
      return NextResponse.json({
        success: false,
        error: 'This gift card is disabled'
      }, { status: 400 });
    }

    // Check if gift card has expired
    if (giftCardData.expiresOn && new Date(giftCardData.expiresOn) < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'This gift card has expired'
      }, { status: 400 });
    }

    // Check if gift card has balance
    const balance = parseFloat(giftCardData.balance.amount);
    if (balance <= 0) {
      return NextResponse.json({
        success: false,
        error: 'This gift card has no remaining balance'
      }, { status: 400 });
    }

    console.log('✅ Gift card validation successful:', {
      code: giftCardData.code,
      balance: balance,
      lastCharacters: giftCardData.lastCharacters
    });

    return NextResponse.json({
      success: true,
      isValid: true,
      isGiftCard: true,
      balance: balance,
      currency: giftCardData.balance.currencyCode,
      code: giftCardData.code,
      lastCharacters: giftCardData.lastCharacters,
      initialValue: parseFloat(giftCardData.initialValue.amount),
      expiresOn: giftCardData.expiresOn,
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