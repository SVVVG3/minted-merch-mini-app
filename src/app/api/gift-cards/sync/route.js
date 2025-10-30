import { NextResponse } from 'next/server';
import { syncAllGiftCards, syncGiftCardToDatabase, validateGiftCard } from '@/lib/giftCards';

export async function POST(request) {
  try {
    const { 
      action = 'sync_all', 
      limit = 50, 
      code = null 
    } = await request.json();
    
    console.log('🔄 Gift card sync request:', { action, limit, code });
    
    if (action === 'sync_all') {
      // Sync all gift cards from Shopify
      console.log(`Starting sync of all gift cards (limit: ${limit})`);
      
      const syncResult = await syncAllGiftCards(limit);
      
      return NextResponse.json({
        success: true,
        message: 'Gift card sync completed',
        action: 'sync_all',
        summary: {
          total: syncResult.total,
          successful: syncResult.successful,
          failed: syncResult.failed,
          successRate: syncResult.total > 0 ? ((syncResult.successful / syncResult.total) * 100).toFixed(1) : 0
        },
        results: syncResult.results
      });
      
    } else if (action === 'sync_single') {
      // Sync a single gift card
      if (!code) {
        return NextResponse.json({
          success: false,
          error: 'Gift card code is required for single sync'
        }, { status: 400 });
      }
      
      console.log(`Starting sync of single gift card: ${code}`);
      
      // Get gift card from Shopify
      const giftCard = await validateGiftCard(code);
      
      if (!giftCard) {
        return NextResponse.json({
          success: false,
          error: 'Gift card not found in Shopify'
        }, { status: 404 });
      }
      
      // Sync to database
      const syncedCard = await syncGiftCardToDatabase(giftCard);
      
      return NextResponse.json({
        success: true,
        message: 'Gift card synced successfully',
        action: 'sync_single',
        giftCard: {
          id: giftCard.id,
          code: giftCard.maskedCode,
          balance: parseFloat(giftCard.balance.amount),
          currency: giftCard.balance.currencyCode,
          enabled: giftCard.enabled,
          expiresAt: giftCard.expiresAt
        },
        database: {
          id: syncedCard.id,
          synced: true,
          syncedAt: syncedCard.synced_at
        }
      });
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "sync_all" or "sync_single"'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Error syncing gift cards:', error);
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
    const action = searchParams.get('action');
    const code = searchParams.get('code');
    
    if (action === 'sync_single' && code) {
      // Quick single sync via GET
      console.log(`Quick sync of gift card: ${code}`);
      
      const giftCard = await validateGiftCard(code);
      
      if (!giftCard) {
        return NextResponse.json({
          success: false,
          error: 'Gift card not found in Shopify'
        }, { status: 404 });
      }
      
      const syncedCard = await syncGiftCardToDatabase(giftCard);
      
      return NextResponse.json({
        success: true,
        message: 'Gift card synced successfully',
        action: 'sync_single',
        giftCard: {
          id: giftCard.id,
          code: giftCard.maskedCode,
          balance: parseFloat(giftCard.balance.amount),
          currency: giftCard.balance.currencyCode,
          enabled: giftCard.enabled,
          expiresAt: giftCard.expiresAt
        },
        database: {
          id: syncedCard.id,
          synced: true,
          syncedAt: syncedCard.synced_at
        }
      });
    }
    
    // Return API documentation
    return NextResponse.json({
      success: true,
      message: 'Gift Card Sync API',
      description: 'Synchronize gift cards between Shopify and database',
      endpoint: 'POST /api/gift-cards/sync',
      actions: {
        sync_all: {
          description: 'Sync all gift cards from Shopify to database',
          parameters: {
            action: '"sync_all"',
            limit: 'number - Maximum number of gift cards to sync (default: 50)'
          },
          example: {
            action: 'sync_all',
            limit: 50
          }
        },
        sync_single: {
          description: 'Sync a single gift card by code',
          parameters: {
            action: '"sync_single"',
            code: 'string - Gift card code to sync'
          },
          example: {
            action: 'sync_single',
            code: 'GIFT-CARD-CODE'
          }
        }
      },
      quickSync: {
        description: 'Quick single sync via GET request',
        endpoint: 'GET /api/gift-cards/sync?action=sync_single&code=GIFT-CARD-CODE'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in gift card sync GET:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 