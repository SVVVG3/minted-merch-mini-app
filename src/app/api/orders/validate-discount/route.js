import { NextResponse } from 'next/server';
import { setUserContext } from '@/lib/auth';
import { validateDiscountForOrder, checkDiscountUsageConflict } from '@/lib/orders';

export async function POST(request) {
  try {
    const { discountCode, fid, subtotal, orderId } = await request.json();

    if (!discountCode) {
      return NextResponse.json({ 
        success: false, 
        error: 'Discount code is required' 
      }, { status: 400 });
    }

    if (!fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'User FID is required' 
      }, { status: 400 });
    }

    // 🔒 SECURITY: Set user context for RLS policies
    await setUserContext(fid);

    if (!subtotal || subtotal <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Valid subtotal is required' 
      }, { status: 400 });
    }

    console.log('Validating discount code for order processing:', { discountCode, fid, subtotal, orderId });

    // Check for usage conflicts with other orders
    const conflictCheck = await checkDiscountUsageConflict(discountCode, orderId);
    
    if (!conflictCheck.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to check discount usage conflicts',
        details: conflictCheck.error
      }, { status: 500 });
    }

    if (conflictCheck.hasConflict) {
      return NextResponse.json({
        success: false,
        error: 'This discount code has already been used in another order',
        errorType: 'DISCOUNT_ALREADY_USED',
        conflictingOrders: conflictCheck.conflictingOrders
      }, { status: 400 });
    }

    // Validate the discount code for order creation
    const validationResult = await validateDiscountForOrder(discountCode, fid, subtotal);
    
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: validationResult.error || 'Invalid discount code',
        errorType: validationResult.errorType || 'VALIDATION_FAILED'
      }, { status: 400 });
    }

    if (!validationResult.isValid) {
      return NextResponse.json({
        success: false,
        error: 'This discount code is not valid',
        errorType: 'INVALID_CODE'
      }, { status: 400 });
    }

    console.log('✅ Discount code validation successful for order processing');
    
    return NextResponse.json({
      success: true,
      isValid: true,
      discountCode: validationResult.discountCode,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      message: 'Discount code is valid for order processing'
    });

  } catch (error) {
    console.error('❌ Error validating discount code for order processing:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to validate discount code for order processing',
      details: error.message
    }, { status: 500 });
  }
}

// Handle GET requests for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const discountCode = searchParams.get('code');
  const fid = searchParams.get('fid');
  const subtotal = parseFloat(searchParams.get('subtotal')) || 100;
  const orderId = searchParams.get('orderId');
  
  if (!discountCode || !fid) {
    return NextResponse.json({
      message: 'Order discount validation endpoint',
      usage: 'POST with { discountCode, fid, subtotal, orderId } or GET with ?code=CODE&fid=FID&subtotal=AMOUNT&orderId=ORDER',
      example: {
        discountCode: 'WELCOME15-XXXXX',
        fid: 12345,
        subtotal: 100.00,
        orderId: 'ORDER_123'
      },
      timestamp: new Date().toISOString()
    });
  }

  // For GET requests, validate the provided parameters
  try {
    // 🔒 SECURITY: Set user context for RLS policies
    await setUserContext(fid);

    // Check for conflicts first
    const conflictCheck = await checkDiscountUsageConflict(discountCode, orderId);
    
    if (conflictCheck.hasConflict) {
      return NextResponse.json({
        success: false,
        error: 'This discount code has already been used in another order',
        conflictingOrders: conflictCheck.conflictingOrders
      });
    }

    const validationResult = await validateDiscountForOrder(discountCode, parseInt(fid), subtotal);
    
    if (!validationResult.success || !validationResult.isValid) {
      return NextResponse.json({
        success: false,
        error: validationResult.error || 'Invalid discount code'
      });
    }

    return NextResponse.json({
      success: true,
      isValid: true,
      discountCode: validationResult.discountCode,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      subtotal: subtotal,
      message: 'Discount code is valid for order processing'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to validate discount code for order processing',
      details: error.message
    });
  }
} 