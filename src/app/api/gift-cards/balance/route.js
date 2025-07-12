import { NextResponse } from 'next/server';
import { getGiftCardBalance, validateGiftCard } from '@/lib/giftCards';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json({
        success: true,
        message: 'Gift Card Balance API',
        description: 'Check the current balance of a gift card',
        endpoint: 'GET /api/gift-cards/balance?code=GIFT-CARD-CODE',
        parameters: {
          required: {
            code: 'string - Gift card code to check balance'
          }
        },
        examples: {
          basic: 'GET /api/gift-cards/balance?code=GIFT-CARD-CODE'
        }
      });
    }
    
    console.log('💰 Gift card balance check request:', { code });
    
    // Get gift card balance
    const balanceInfo = await getGiftCardBalance(code.trim());
    
    if (!balanceInfo) {
      return NextResponse.json({
        success: false,
        error: 'Gift card not found',
        code: code
      }, { status: 404 });
    }
    
    // Get full gift card details for additional info
    const giftCard = await validateGiftCard(code.trim());
    
    // Determine status
    let status = 'active';
    if (!giftCard.enabled) {
      status = 'disabled';
    } else if (giftCard.expiresAt && new Date(giftCard.expiresAt) <= new Date()) {
      status = 'expired';
    } else if (balanceInfo.balance <= 0) {
      status = 'depleted';
    }
    
    return NextResponse.json({
      success: true,
      message: 'Gift card balance retrieved successfully',
      giftCard: {
        id: giftCard.id,
        code: giftCard.maskedCode,
        balance: balanceInfo.balance,
        currency: balanceInfo.currency,
        enabled: balanceInfo.enabled,
        status: status,
        createdAt: giftCard.createdAt,
        expiresAt: giftCard.expiresAt,
        note: giftCard.note,
        isUsable: status === 'active' && balanceInfo.balance > 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking gift card balance:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { code } = await request.json();
    
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Gift card code is required'
      }, { status: 400 });
    }
    
    console.log('💰 Gift card balance check request (POST):', { code });
    
    // Get gift card balance
    const balanceInfo = await getGiftCardBalance(code.trim());
    
    if (!balanceInfo) {
      return NextResponse.json({
        success: false,
        error: 'Gift card not found',
        code: code
      }, { status: 404 });
    }
    
    // Get full gift card details for additional info
    const giftCard = await validateGiftCard(code.trim());
    
    // Determine status
    let status = 'active';
    if (!giftCard.enabled) {
      status = 'disabled';
    } else if (giftCard.expiresAt && new Date(giftCard.expiresAt) <= new Date()) {
      status = 'expired';
    } else if (balanceInfo.balance <= 0) {
      status = 'depleted';
    }
    
    return NextResponse.json({
      success: true,
      message: 'Gift card balance retrieved successfully',
      giftCard: {
        id: giftCard.id,
        code: giftCard.maskedCode,
        balance: balanceInfo.balance,
        currency: balanceInfo.currency,
        enabled: balanceInfo.enabled,
        status: status,
        createdAt: giftCard.createdAt,
        expiresAt: giftCard.expiresAt,
        note: giftCard.note,
        isUsable: status === 'active' && balanceInfo.balance > 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking gift card balance:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
} 