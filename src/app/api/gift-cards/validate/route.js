import { NextResponse } from 'next/server';
import { validateGiftCardForCheckout, isGiftCardUsable } from '@/lib/giftCards';

export async function POST(request) {
  try {
    const { code, cartTotal = 0 } = await request.json();
    
    console.log('🔍 Gift card validation request:', { code, cartTotal });
    
    // Validate input
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Gift card code is required'
      }, { status: 400 });
    }
    
    if (typeof cartTotal !== 'number' || cartTotal < 0) {
      return NextResponse.json({
        success: false,
        error: 'Cart total must be a valid number'
      }, { status: 400 });
    }
    
    // Validate gift card for checkout
    const validationResult = await validateGiftCardForCheckout(code.trim(), cartTotal);
    
    if (!validationResult.isValid) {
      return NextResponse.json({
        success: false,
        isValid: false,
        error: validationResult.error,
        giftCard: validationResult.giftCard ? {
          id: validationResult.giftCard.id,
          code: code.trim(), // Return actual code for consumption
          maskedCode: validationResult.giftCard.maskedCode, // Keep masked for display
          balance: parseFloat(validationResult.giftCard.balance.amount),
          currency: validationResult.giftCard.balance.currencyCode,
          enabled: validationResult.giftCard.enabled,
          expiresAt: validationResult.giftCard.expiresAt
        } : null
      }, { status: 400 });
    }
    
    // Return valid gift card details
    return NextResponse.json({
      success: true,
      isValid: true,
      message: 'Gift card is valid and can be used',
      giftCard: {
        id: validationResult.giftCard.id,
        code: code.trim(), // Return actual code for consumption
        maskedCode: validationResult.giftCard.maskedCode, // Keep masked for display
        balance: parseFloat(validationResult.giftCard.balance.amount),
        currency: validationResult.giftCard.balance.currencyCode,
        enabled: validationResult.giftCard.enabled,
        createdAt: validationResult.giftCard.createdAt,
        expiresAt: validationResult.giftCard.expiresAt,
        note: validationResult.giftCard.note
      },
      discount: {
        discountAmount: validationResult.discount.discountAmount,
        remainingBalance: validationResult.discount.remainingBalance,
        finalTotal: validationResult.discount.finalTotal
      }
    });
    
  } catch (error) {
    console.error('❌ Error validating gift card:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json({
        success: true,
        message: 'Gift Card Validation API',
        description: 'Validate gift cards for checkout use',
        endpoint: 'POST /api/gift-cards/validate',
        parameters: {
          required: {
            code: 'string - Gift card code to validate'
          },
          optional: {
            cartTotal: 'number - Cart total to calculate discount (default: 0)'
          }
        },
        examples: {
          basic: {
            code: 'GIFT-CARD-CODE'
          },
          withCartTotal: {
            code: 'GIFT-CARD-CODE',
            cartTotal: 99.99
          }
        },
        quickCheck: 'Add ?code=GIFT-CARD-CODE to URL for quick validation'
      });
    }
    
    // Quick validation check via GET request
    const validationResult = await validateGiftCardForCheckout(code, 0);
    
    return NextResponse.json({
      success: true,
      isValid: validationResult.isValid,
      error: validationResult.error,
      giftCard: validationResult.giftCard ? {
        id: validationResult.giftCard.id,
        code: code, // Return actual code for consumption
        maskedCode: validationResult.giftCard.maskedCode, // Keep masked for display
        balance: parseFloat(validationResult.giftCard.balance.amount),
        currency: validationResult.giftCard.balance.currencyCode,
        enabled: validationResult.giftCard.enabled,
        expiresAt: validationResult.giftCard.expiresAt
      } : null
    });
    
  } catch (error) {
    console.error('❌ Error in gift card validation GET:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 