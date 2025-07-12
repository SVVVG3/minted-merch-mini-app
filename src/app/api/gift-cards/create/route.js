import { NextResponse } from 'next/server';
import { createShopifyGiftCard, syncGiftCardToDatabase } from '@/lib/giftCards';

export async function POST(request) {
  try {
    const { 
      amount, 
      note = null, 
      expiresAt = null, 
      fid = null, 
      recipientEmail = null 
    } = await request.json();
    
    console.log('🎁 Gift card creation request:', {
      amount,
      note,
      expiresAt,
      fid,
      recipientEmail
    });
    
    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Valid amount is required (must be a positive number)'
      }, { status: 400 });
    }
    
    // Check maximum gift card value (Shopify limit is $2,000 USD)
    if (amount > 2000) {
      return NextResponse.json({
        success: false,
        error: 'Gift card amount cannot exceed $2,000 USD'
      }, { status: 400 });
    }
    
    // Validate expiration date if provided
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Expiration date must be in the future'
      }, { status: 400 });
    }
    
    // Create gift card in Shopify
    console.log('Creating gift card in Shopify...');
    const shopifyResult = await createShopifyGiftCard(amount, note, expiresAt);
    
    if (shopifyResult.userErrors && shopifyResult.userErrors.length > 0) {
      console.error('❌ Shopify gift card creation error:', shopifyResult.userErrors);
      return NextResponse.json({
        success: false,
        error: `Shopify error: ${shopifyResult.userErrors[0].message}`,
        details: shopifyResult.userErrors
      }, { status: 400 });
    }
    
    if (!shopifyResult.giftCard) {
      console.error('❌ No gift card returned from Shopify');
      return NextResponse.json({
        success: false,
        error: 'Failed to create gift card in Shopify'
      }, { status: 500 });
    }
    
    // Sync to database
    console.log('Syncing gift card to database...');
    const dbResult = await syncGiftCardToDatabase(
      shopifyResult.giftCard, 
      fid, 
      recipientEmail
    );
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Gift card created successfully',
      giftCard: {
        id: shopifyResult.giftCard.id,
        code: shopifyResult.giftCard.maskedCode,
        balance: parseFloat(shopifyResult.giftCard.balance.amount),
        currency: shopifyResult.giftCard.balance.currencyCode,
        enabled: shopifyResult.giftCard.enabled,
        createdAt: shopifyResult.giftCard.createdAt,
        expiresAt: shopifyResult.giftCard.expiresAt,
        note: shopifyResult.giftCard.note
      },
      database: {
        id: dbResult.id,
        synced: true
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating gift card:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Gift Card Creation API',
    description: 'Create gift cards in Shopify and sync to database',
    endpoint: 'POST /api/gift-cards/create',
    parameters: {
      required: {
        amount: 'number - Gift card value in USD (max $2,000)'
      },
      optional: {
        note: 'string - Optional note for the gift card',
        expiresAt: 'string - ISO date string for expiration (future date)',
        fid: 'number - Farcaster ID of the creator',
        recipientEmail: 'string - Email of the recipient'
      }
    },
    examples: {
      basic: {
        amount: 50
      },
      withNote: {
        amount: 100,
        note: 'Happy Birthday!'
      },
      withExpiration: {
        amount: 25,
        note: 'Holiday Gift',
        expiresAt: '2025-12-31T23:59:59Z'
      },
      withCreator: {
        amount: 75,
        note: 'Thanks for your support!',
        fid: 466111,
        recipientEmail: 'recipient@example.com'
      }
    }
  });
} 