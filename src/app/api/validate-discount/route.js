import { NextResponse } from 'next/server';
import { setUserContext } from '@/lib/auth';
import { validateDiscountCode, calculateDiscountAmount } from '@/lib/discounts';

export async function POST(request) {
  try {
    const { code, fid, subtotal } = await request.json();

    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Discount code is required' 
      }, { status: 400 });
    }

    if (!subtotal || subtotal <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Valid subtotal is required' 
      }, { status: 400 });
    }

    console.log('Validating discount code:', { code, fid: fid || 'null', subtotal });

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
    
    console.log('Discount validation successful:', {
      code,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      discountAmount: discountResult.discountAmount,
      subtotal,
      requiresAuth: validationResult.requiresAuth || false
    });

    return NextResponse.json({
      success: true,
      isValid: true,
      code: validationResult.code,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      discountAmount: discountResult.discountAmount,
      subtotal,
      requiresAuth: validationResult.requiresAuth || false
    });

  } catch (error) {
    console.error('❌ Error validating discount code:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to validate discount code',
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
      message: 'Discount validation endpoint',
      usage: 'POST with { code, fid, subtotal } or GET with ?code=CODE&fid=FID&subtotal=AMOUNT',
      note: 'FID is optional - some codes work without authentication',
      example: {
        code: 'WELCOME15-XXXXX',
        fid: 12345, // optional
        subtotal: 100.00
      },
      timestamp: new Date().toISOString()
    });
  }

  // For GET requests, validate the provided parameters
  try {
    const parsedFid = fid ? parseInt(fid) : null;
    
    // 🔒 SECURITY: Set user context for RLS policies  
    if (parsedFid) {
      await setUserContext(parsedFid);
    }

    const validationResult = await validateDiscountCode(code, parsedFid);
    
    if (!validationResult.success || !validationResult.isValid) {
      return NextResponse.json({
        success: false,
        error: validationResult.error || 'Invalid discount code'
      });
    }

    const discountResult = calculateDiscountAmount(subtotal, validationResult);
    
    return NextResponse.json({
      success: true,
      isValid: true,
      code: validationResult.code,
      discountType: validationResult.discountType,
      discountValue: validationResult.discountValue,
      discountAmount: discountResult.discountAmount,
      subtotal: subtotal,
      requiresAuth: validationResult.requiresAuth || false
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to validate discount code',
      details: error.message
    });
  }
} 