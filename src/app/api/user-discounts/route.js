import { NextResponse } from 'next/server';
import { getUserAvailableDiscounts, getBestAvailableDiscount, hasDiscountOfType } from '@/lib/discounts';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const includeUsed = searchParams.get('includeUsed') === 'true';
    const codeType = searchParams.get('type'); // Optional filter by code type
    const mode = searchParams.get('mode') || 'all'; // 'all', 'best', 'check'
    const scope = searchParams.get('scope') || 'site_wide'; // 'site_wide', 'product', 'any'
    const productIds = searchParams.get('productIds') ? JSON.parse(searchParams.get('productIds')) : [];

    console.log('=== USER DISCOUNT LOOKUP ===');
    console.log('FID:', fid);
    console.log('Include Used:', includeUsed);
    console.log('Code Type:', codeType);
    console.log('Mode:', mode);
    console.log('Scope:', scope);
    console.log('Product IDs:', productIds);

    // Validate FID
    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'FID parameter is required'
      }, { status: 400 });
    }

    const userFid = parseInt(fid);
    if (isNaN(userFid)) {
      return NextResponse.json({
        success: false,
        error: 'FID must be a valid number'
      }, { status: 400 });
    }

    // 🔒 SECURITY: Set user context for RLS policies
    await supabase.rpc('set_config', {
      parameter: 'app.user_fid', 
      value: fid.toString()
    });

    // Handle different modes
    if (mode === 'best') {
      // Get the best available discount code
      const result = await getBestAvailableDiscount(userFid, scope, productIds);
      
      return NextResponse.json({
        success: result.success,
        mode: 'best',
        scope: scope,
        productIds: productIds,
        discountCode: result.discountCode,
        alternativeCodes: result.alternativeCodes,
        error: result.error || null
      });

    } else if (mode === 'check') {
      // Check if user has specific type of discount
      const checkType = codeType || 'welcome';
      const result = await hasDiscountOfType(userFid, checkType);
      
      return NextResponse.json({
        success: result.success,
        mode: 'check',
        codeType: checkType,
        hasDiscount: result.hasDiscount,
        count: result.count,
        codes: result.codes,
        error: result.error || null
      });

    } else {
      // Default: Get all available discount codes
      const result = await getUserAvailableDiscounts(userFid, includeUsed);

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error,
          discountCodes: []
        }, { status: 500 });
      }

      // Filter by code type if specified
      let filteredCodes = result.discountCodes;
      if (codeType) {
        filteredCodes = result.discountCodes.filter(code => code.code_type === codeType);
        
        // Recalculate summary for filtered results
        const usableFiltered = filteredCodes.filter(code => code.isUsable);
        const usedFiltered = filteredCodes.filter(code => code.is_used);
        const expiredFiltered = filteredCodes.filter(code => code.isExpired && !code.is_used);
        
        return NextResponse.json({
          success: true,
          mode: 'all',
          fid: userFid,
          includeUsed,
          codeType,
          discountCodes: filteredCodes,
          summary: {
            total: filteredCodes.length,
            usable: usableFiltered.length,
            used: usedFiltered.length,
            expired: expiredFiltered.length
          },
          categorized: {
            usable: usableFiltered,
            used: usedFiltered,
            expired: expiredFiltered
          }
        });
      }

      return NextResponse.json({
        success: true,
        mode: 'all',
        fid: userFid,
        includeUsed,
        discountCodes: result.discountCodes,
        summary: result.summary,
        categorized: result.categorized
      });
    }

  } catch (error) {
    console.error('❌ Error in user-discounts API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

// POST endpoint for creating new discount codes (if needed)
export async function POST(request) {
  try {
    const { fid, codeType, discountValue, discountType, expiresAt } = await request.json();

    if (!fid || !codeType) {
      return NextResponse.json({
        success: false,
        error: 'FID and codeType are required'
      }, { status: 400 });
    }

    console.log('Creating new discount code:', { fid, codeType, discountValue, discountType });

    // 🔒 SECURITY: Set user context for RLS policies
    await supabase.rpc('set_config', {
      parameter: 'app.user_fid', 
      value: fid.toString()
    });

    // For now, we'll use the existing createWelcomeDiscountCode function
    // In the future, this could be expanded to create other types of codes
    if (codeType === 'welcome') {
      const { createWelcomeDiscountCode } = await import('@/lib/discounts');
      const result = await createWelcomeDiscountCode(fid);
      
      return NextResponse.json({
        success: result.success,
        discountCode: result.discountCode,
        code: result.code,
        isExisting: result.isExisting,
        error: result.error || null
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Only welcome discount creation is currently supported'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error creating discount code:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

// DELETE endpoint for managing discount codes (admin functionality)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const code = searchParams.get('code');

    if (!fid && !code) {
      return NextResponse.json({
        success: false,
        error: 'Either FID or code parameter is required'
      }, { status: 400 });
    }

    // 🔒 SECURITY: Set user context for RLS policies if FID provided
    if (fid) {
      await supabase.rpc('set_config', {
        parameter: 'app.user_fid', 
        value: fid.toString()
      });
    }

    // This would be used for admin operations or user account cleanup
    // For now, return not implemented
    return NextResponse.json({
      success: false,
      error: 'DELETE operations not implemented yet'
    }, { status: 501 });

  } catch (error) {
    console.error('❌ Error in DELETE user-discounts:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
} 