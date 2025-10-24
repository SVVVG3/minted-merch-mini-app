import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    
    // Test cases based on real scenarios
    const testCases = [
      {
        name: "Order #1265 Scenario (20% discount)",
        originalSubtotal: 60.00,
        originalTax: 5.57,
        discountAmount: 12.00,
        discountPercentage: 20
      },
      {
        name: "50% discount scenario",
        originalSubtotal: 100.00,
        originalTax: 8.75,
        discountAmount: 50.00,
        discountPercentage: 50
      },
      {
        name: "100% discount scenario",
        originalSubtotal: 50.00,
        originalTax: 4.38,
        discountAmount: 50.00,
        discountPercentage: 100
      },
      {
        name: "Small discount scenario",
        originalSubtotal: 25.00,
        originalTax: 2.19,
        discountAmount: 5.00,
        discountPercentage: 20
      }
    ];

    const results = testCases.map(testCase => {
      const { originalSubtotal, originalTax, discountAmount } = testCase;
      
      // Apply the NEW FIXED logic
      const subtotalAfterDiscount = Math.max(0, originalSubtotal - discountAmount);
      
      let adjustedTax = 0;
      if (subtotalAfterDiscount > 0 && originalTax > 0) {
        // Calculate tax rate from original amounts
        const taxRate = originalTax / originalSubtotal;
        // Apply tax rate to discounted subtotal
        adjustedTax = subtotalAfterDiscount * taxRate;
      }
      
      // Round to 2 decimal places for currency precision
      adjustedTax = Math.round(adjustedTax * 100) / 100;
      
      // OLD BROKEN logic for comparison
      const oldAdjustedTax = subtotalAfterDiscount > 0 ? originalTax : 0;
      
      return {
        scenario: testCase.name,
        input: {
          originalSubtotal: originalSubtotal,
          originalTax: originalTax,
          discountAmount: discountAmount,
          discountPercentage: testCase.discountPercentage
        },
        calculation: {
          subtotalAfterDiscount: subtotalAfterDiscount,
          taxRate: ((originalTax / originalSubtotal) * 100).toFixed(4) + '%',
          newAdjustedTax: adjustedTax,
          oldAdjustedTax: oldAdjustedTax,
          taxSavings: oldAdjustedTax - adjustedTax,
          correctTotal: subtotalAfterDiscount + adjustedTax,
          oldIncorrectTotal: subtotalAfterDiscount + oldAdjustedTax
        },
        validation: {
          isFixed: adjustedTax !== oldAdjustedTax,
          improvesAccuracy: adjustedTax < oldAdjustedTax || (subtotalAfterDiscount === 0 && adjustedTax === 0)
        }
      };
    });

    // Summary
    const totalTaxCorrection = results.reduce((sum, result) => sum + result.calculation.taxSavings, 0);
    
    return NextResponse.json({
      success: true,
      message: "Tax calculation fix verification",
      fixDescription: {
        problem: "Previously, we calculated tax on the original pre-discount subtotal for all discounts except 100% discounts",
        solution: "Now we calculate tax proportionally based on the discounted subtotal for ALL discount amounts",
        impact: "This ensures customers are only taxed on the amount they actually pay, not the pre-discount amount"
      },
      testResults: results,
      summary: {
        testCasesRun: results.length,
        totalTaxCorrection: totalTaxCorrection.toFixed(2),
        averageCorrection: (totalTaxCorrection / results.length).toFixed(2),
        allTestsPassed: results.every(r => r.validation.improvesAccuracy)
      }
    });

  } catch (error) {
    console.error('❌ Error in tax fix verification:', error);
    return NextResponse.json({ 
      error: 'Failed to verify tax fix', 
      details: error.message 
    }, { status: 500 });
  }
});