import { NextResponse } from 'next/server';
import { validateDiscountCode } from '@/lib/discounts';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code') || 'DICKBUTT-FREE';
    const fid = searchParams.get('fid') || '466111';  // Test FID
    
    console.log(`🧪 Testing free shipping discount: ${code} for FID: ${fid}`);
    
    // Test discount validation
    const validationResult = await validateDiscountCode(code, parseInt(fid));
    
    console.log('📊 Discount validation result:', {
      success: validationResult.success,
      isValid: validationResult.isValid,
      code: validationResult.code,
      freeShipping: validationResult.freeShipping,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      requiresAuth: validationResult.requiresAuth
    });
    
    // Test with a subtotal to see discount calculation
    const testSubtotal = 29.97;  // Price of Dickbutt cap
    
    if (validationResult.success && validationResult.isValid) {
      const { calculateDiscountAmount } = await import('@/lib/discounts');
      const discountResult = calculateDiscountAmount(testSubtotal, validationResult);
      
      console.log('💰 Discount calculation result:', {
        originalSubtotal: testSubtotal,
        discountAmount: discountResult.discountAmount,
        finalTotal: discountResult.finalTotal,
        freeShipping: validationResult.freeShipping
      });
      
      return NextResponse.json({
        success: true,
        testCode: code,
        testFid: fid,
        validation: {
          isValid: validationResult.isValid,
          code: validationResult.code,
          discountType: validationResult.discountType,
          discountValue: validationResult.discountValue,
          freeShipping: validationResult.freeShipping || false,
          requiresAuth: validationResult.requiresAuth || false
        },
        calculation: {
          originalSubtotal: testSubtotal,
          discountAmount: discountResult.discountAmount,
          finalTotal: discountResult.finalTotal,
          expectedTotal: validationResult.freeShipping ? 0 : discountResult.finalTotal
        },
        expectedBehavior: {
          shouldShowFreeShipping: validationResult.freeShipping || false,
          shouldShowZeroTotal: validationResult.discountValue >= 100 && validationResult.freeShipping,
          shouldAutoSelectFreeShipping: validationResult.freeShipping || false
        },
        message: validationResult.freeShipping 
          ? `✅ FREE SHIPPING ENABLED: ${code} includes 100% discount + free shipping!`
          : `❌ NO FREE SHIPPING: ${code} does not include free shipping`
      });
    } else {
      return NextResponse.json({
        success: false,
        testCode: code,
        testFid: fid,
        error: validationResult.error || 'Discount validation failed',
        validation: validationResult
      });
    }
    
  } catch (error) {
    console.error('❌ Free shipping test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Failed to test free shipping discount'
    }, { status: 500 });
  }
} 