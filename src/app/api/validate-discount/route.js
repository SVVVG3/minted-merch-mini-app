import { NextResponse } from 'next/server';
import { setUserContext } from '@/lib/auth';
import { validateDiscountCode, calculateDiscountAmount, isGiftCardCode, validateGiftCardCode, cartContainsGiftCards } from '@/lib/discounts';

export async function POST(request) {
  try {
    const { code, fid, subtotal, cartItems } = await request.json();

    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Code is required' 
      }, { status: 400 });
    }

    if (!subtotal || subtotal <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Valid subtotal is required' 
      }, { status: 400 });
    }

    console.log('🔍 Validating code:', { code, fid: fid || 'null', subtotal, hasCartItems: !!cartItems });

    // Check if this is a gift card code
    if (isGiftCardCode(code)) {
      console.log('🎁 Detected gift card code, validating with Shopify');
      
      const giftCardResult = await validateGiftCardCode(code);
      
      if (!giftCardResult.success) {
        return NextResponse.json({
          success: false,
          error: giftCardResult.error || 'Invalid gift card code'
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        isValid: true,
        isGiftCard: true,
        balance: giftCardResult.balance,
        currency: giftCardResult.currency,
        code: giftCardResult.code,
        message: giftCardResult.message
      });
    }

    // This is a discount code - check if cart contains only gift cards
    if (cartItems && cartItems.length > 0) {
      // Helper function to check if item is a gift card
      const isGiftCardItem = (item) => {
        const productTitle = item.product?.title || item.title || '';
        const productHandle = item.product?.handle || '';
        
        return (
          productTitle.toLowerCase().includes('gift card') ||
          productHandle.includes('gift-card')
        );
      };

      // Filter cart to get only non-gift-card items
      const discountEligibleItems = cartItems.filter(item => !isGiftCardItem(item));
      const hasGiftCards = cartItems.some(item => isGiftCardItem(item));

      if (discountEligibleItems.length === 0) {
        console.log('🚫 Cart contains only gift cards, blocking discount application');
        return NextResponse.json({
          success: false,
          error: 'Discount codes cannot be applied to gift cards'
        }, { status: 400 });
      }

      if (hasGiftCards) {
        console.log('🎁 Cart contains mixed items - validating discount for eligible items only');
        
        // Calculate subtotal for discount-eligible items only
        const discountEligibleSubtotal = discountEligibleItems.reduce((total, item) => {
          const price = parseFloat(item.price || 0);
          const quantity = parseInt(item.quantity || 1);
          return total + (price * quantity);
        }, 0);

        // Update subtotal to only include eligible items
        if (discountEligibleSubtotal > 0 && discountEligibleSubtotal < subtotal) {
          console.log(`📊 Adjusting subtotal from $${subtotal} to $${discountEligibleSubtotal} (eligible items only)`);
          subtotal = discountEligibleSubtotal;
        }
      }
    }

    // 🔒 SECURITY: Set user context for RLS policies  
    if (fid) {
      await setUserContext(fid);
    }

    // Validate the discount code
    // Pass null FID if not authenticated - some discount codes might not require user auth
    const validationResult = await validateDiscountCode(code, fid || null);
    
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: validationResult.error || 'Invalid discount code'
      }, { status: 400 });
    }

    if (!validationResult.isValid) {
      return NextResponse.json({
        success: false,
        error: 'This discount code is not valid or has already been used'
      }, { status: 400 });
    }

    // Calculate discount amount
    const discountResult = calculateDiscountAmount(subtotal, validationResult);
    
    if (discountResult.error) {
      return NextResponse.json({
        success: false,
        error: discountResult.error
      }, { status: 400 });
    }
    
    console.log('✅ Discount validation successful:', {
      code: validationResult.code,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      discountAmount: discountResult.discountAmount,
      subtotal,
      requiresAuth: validationResult.requiresAuth || false
    });

    return NextResponse.json({
      success: true,
      isValid: true,
      isGiftCard: false,
      code: validationResult.code,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      discountAmount: discountResult.discountAmount,
      freeShipping: validationResult.freeShipping || false,
      subtotal,
      requiresAuth: validationResult.requiresAuth || false
    });

  } catch (error) {
    console.error('❌ Error validating code:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to validate code',
      details: error.message
    }, { status: 500 });
  }
}

// Handle GET requests for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const fid = searchParams.get('fid');
  const subtotal = parseFloat(searchParams.get('subtotal')) || 100;
  
  if (!code) {
    return NextResponse.json({
      message: 'Code validation endpoint (handles both discount codes and gift cards)',
      usage: 'POST with { code, fid, subtotal, cartItems } or GET with ?code=CODE&fid=FID&subtotal=AMOUNT',
      note: 'FID is optional for some codes, cartItems is optional but recommended',
      example: {
        code: 'WELCOME15-XXXXX or GIFTCARDCODE123',
        fid: 12345, // optional
        subtotal: 100.00,
        cartItems: [{ product: { title: 'T-Shirt' } }] // optional
      },
      timestamp: new Date().toISOString()
    });
  }

  // For GET requests, validate the provided parameters
  try {
    const parsedFid = fid ? parseInt(fid) : null;
    
    const body = JSON.stringify({ 
      code, 
      fid: parsedFid, 
      subtotal,
      cartItems: [] // Empty cart for GET requests
    });
    
    const response = await POST(new Request(request.url, { 
      method: 'POST', 
      body,
      headers: { 'Content-Type': 'application/json' }
    }));
    
    return response;

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to validate code',
      details: error.message
    });
  }
} 