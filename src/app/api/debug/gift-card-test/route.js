import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/adminAuth';
import { 
  createShopifyGiftCard, 
  validateGiftCard, 
  getGiftCardBalance, 
  validateGiftCardForCheckout,
  syncGiftCardToDatabase,
  getGiftCardFromDatabase,
  calculateGiftCardDiscount,
  isGiftCardUsable
} from '@/lib/giftCards';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test');
    const code = searchParams.get('code');
    const amount = searchParams.get('amount');
    
    console.log('🧪 Gift card test request:', { test, code, amount });
    
    if (test === 'create' && amount) {
      // Test gift card creation
      console.log('Testing gift card creation...');
      
      const testAmount = parseFloat(amount);
      if (testAmount <= 0 || testAmount > 2000) {
        return NextResponse.json({
          success: false,
          error: 'Amount must be between 0 and 2000'
        }, { status: 400 });
      }
      
      const result = await createShopifyGiftCard(
        testAmount, 
        `Test gift card created at ${new Date().toISOString()}`
      );
      
      if (result.userErrors && result.userErrors.length > 0) {
        return NextResponse.json({
          success: false,
          error: result.userErrors[0].message,
          details: result.userErrors
        }, { status: 400 });
      }
      
      // Sync to database
      const dbResult = await syncGiftCardToDatabase(result.giftCard);
      
      return NextResponse.json({
        success: true,
        test: 'create',
        message: 'Test gift card created successfully',
        giftCard: {
          id: result.giftCard.id,
          code: result.giftCard.maskedCode,
          balance: parseFloat(result.giftCard.balance.amount),
          currency: result.giftCard.balance.currencyCode,
          enabled: result.giftCard.enabled,
          createdAt: result.giftCard.createdAt,
          expiresAt: result.giftCard.expiresAt,
          note: result.giftCard.note
        },
        database: {
          id: dbResult.id,
          synced: true
        }
      });
      
    } else if (test === 'validate' && code) {
      // Test gift card validation
      console.log('Testing gift card validation...');
      
      const giftCard = await validateGiftCard(code);
      
      if (!giftCard) {
        return NextResponse.json({
          success: false,
          test: 'validate',
          error: 'Gift card not found',
          code: code
        }, { status: 404 });
      }
      
      const isUsable = isGiftCardUsable(giftCard);
      
      return NextResponse.json({
        success: true,
        test: 'validate',
        message: 'Gift card validation completed',
        giftCard: {
          id: giftCard.id,
          code: giftCard.maskedCode,
          balance: parseFloat(giftCard.balance.amount),
          currency: giftCard.balance.currencyCode,
          enabled: giftCard.enabled,
          createdAt: giftCard.createdAt,
          expiresAt: giftCard.expiresAt,
          note: giftCard.note,
          isUsable: isUsable
        }
      });
      
    } else if (test === 'balance' && code) {
      // Test balance check
      console.log('Testing gift card balance check...');
      
      const balance = await getGiftCardBalance(code);
      
      if (!balance) {
        return NextResponse.json({
          success: false,
          test: 'balance',
          error: 'Gift card not found',
          code: code
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        test: 'balance',
        message: 'Gift card balance retrieved successfully',
        balance: balance
      });
      
    } else if (test === 'checkout' && code) {
      // Test checkout validation
      console.log('Testing gift card checkout validation...');
      
      const cartTotal = parseFloat(amount) || 99.99;
      const validationResult = await validateGiftCardForCheckout(code, cartTotal);
      
      return NextResponse.json({
        success: true,
        test: 'checkout',
        message: 'Gift card checkout validation completed',
        cartTotal: cartTotal,
        validation: validationResult
      });
      
    } else if (test === 'discount' && code) {
      // Test discount calculation
      console.log('Testing gift card discount calculation...');
      
      const cartTotal = parseFloat(amount) || 99.99;
      const giftCard = await validateGiftCard(code);
      
      if (!giftCard) {
        return NextResponse.json({
          success: false,
          test: 'discount',
          error: 'Gift card not found',
          code: code
        }, { status: 404 });
      }
      
      const balance = parseFloat(giftCard.balance.amount);
      const discount = calculateGiftCardDiscount(cartTotal, balance);
      
      return NextResponse.json({
        success: true,
        test: 'discount',
        message: 'Gift card discount calculation completed',
        cartTotal: cartTotal,
        giftCardBalance: balance,
        discount: discount
      });
      
    } else {
      // Return test documentation
      return NextResponse.json({
        success: true,
        message: 'Gift Card Test API',
        description: 'Comprehensive testing endpoint for gift card functionality',
        availableTests: {
          create: {
            description: 'Create a test gift card',
            endpoint: 'GET /api/debug/gift-card-test?test=create&amount=50',
            parameters: {
              test: '"create"',
              amount: 'number - Gift card amount (1-2000)'
            }
          },
          validate: {
            description: 'Validate a gift card',
            endpoint: 'GET /api/debug/gift-card-test?test=validate&code=GIFT-CARD-CODE',
            parameters: {
              test: '"validate"',
              code: 'string - Gift card code'
            }
          },
          balance: {
            description: 'Check gift card balance',
            endpoint: 'GET /api/debug/gift-card-test?test=balance&code=GIFT-CARD-CODE',
            parameters: {
              test: '"balance"',
              code: 'string - Gift card code'
            }
          },
          checkout: {
            description: 'Test checkout validation',
            endpoint: 'GET /api/debug/gift-card-test?test=checkout&code=GIFT-CARD-CODE&amount=99.99',
            parameters: {
              test: '"checkout"',
              code: 'string - Gift card code',
              amount: 'number - Cart total (optional, default: 99.99)'
            }
          },
          discount: {
            description: 'Test discount calculation',
            endpoint: 'GET /api/debug/gift-card-test?test=discount&code=GIFT-CARD-CODE&amount=99.99',
            parameters: {
              test: '"discount"',
              code: 'string - Gift card code',
              amount: 'number - Cart total (optional, default: 99.99)'
            }
          }
        },
        examples: {
          createTestCard: '/api/debug/gift-card-test?test=create&amount=50',
          validateCard: '/api/debug/gift-card-test?test=validate&code=YOUR-GIFT-CARD-CODE',
          checkBalance: '/api/debug/gift-card-test?test=balance&code=YOUR-GIFT-CARD-CODE',
          testCheckout: '/api/debug/gift-card-test?test=checkout&code=YOUR-GIFT-CARD-CODE&amount=99.99'
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error in gift card test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { test, data } = await request.json();
    
    console.log('🧪 Gift card test POST request:', { test, data });
    
    if (test === 'comprehensive') {
      // Run comprehensive test suite
      console.log('Running comprehensive gift card test suite...');
      
      const results = {
        testSuite: 'comprehensive',
        timestamp: new Date().toISOString(),
        tests: []
      };
      
      try {
        // Test 1: Create a test gift card
        console.log('Test 1: Creating test gift card...');
        const createResult = await createShopifyGiftCard(25, 'Comprehensive test gift card');
        
        if (createResult.userErrors && createResult.userErrors.length > 0) {
          throw new Error(`Gift card creation failed: ${createResult.userErrors[0].message}`);
        }
        
        const testCode = createResult.giftCard.maskedCode;
        
        results.tests.push({
          name: 'create',
          success: true,
          message: 'Test gift card created successfully',
          data: {
            code: testCode,
            balance: parseFloat(createResult.giftCard.balance.amount)
          }
        });
        
        // Test 2: Validate the created gift card
        console.log('Test 2: Validating gift card...');
        const giftCard = await validateGiftCard(testCode);
        
        if (!giftCard) {
          throw new Error('Gift card validation failed');
        }
        
        results.tests.push({
          name: 'validate',
          success: true,
          message: 'Gift card validation successful',
          data: {
            code: giftCard.maskedCode,
            balance: parseFloat(giftCard.balance.amount),
            enabled: giftCard.enabled
          }
        });
        
        // Test 3: Check balance
        console.log('Test 3: Checking balance...');
        const balance = await getGiftCardBalance(testCode);
        
        if (!balance) {
          throw new Error('Balance check failed');
        }
        
        results.tests.push({
          name: 'balance',
          success: true,
          message: 'Balance check successful',
          data: balance
        });
        
        // Test 4: Test checkout validation
        console.log('Test 4: Testing checkout validation...');
        const checkoutResult = await validateGiftCardForCheckout(testCode, 50);
        
        results.tests.push({
          name: 'checkout',
          success: checkoutResult.isValid,
          message: checkoutResult.isValid ? 'Checkout validation successful' : checkoutResult.error,
          data: checkoutResult
        });
        
        // Test 5: Test discount calculation
        console.log('Test 5: Testing discount calculation...');
        const discountResult = calculateGiftCardDiscount(50, 25);
        
        results.tests.push({
          name: 'discount',
          success: true,
          message: 'Discount calculation successful',
          data: discountResult
        });
        
        // Test 6: Sync to database
        console.log('Test 6: Syncing to database...');
        const dbResult = await syncGiftCardToDatabase(createResult.giftCard);
        
        results.tests.push({
          name: 'sync',
          success: true,
          message: 'Database sync successful',
          data: {
            id: dbResult.id,
            synced: true
          }
        });
        
        // Test 7: Get from database
        console.log('Test 7: Getting from database...');
        const dbGiftCard = await getGiftCardFromDatabase(testCode);
        
        results.tests.push({
          name: 'database_get',
          success: !!dbGiftCard,
          message: dbGiftCard ? 'Database retrieval successful' : 'Database retrieval failed',
          data: dbGiftCard ? {
            id: dbGiftCard.id,
            code: dbGiftCard.code,
            balance: dbGiftCard.current_balance
          } : null
        });
        
      } catch (error) {
        results.tests.push({
          name: 'error',
          success: false,
          message: `Test suite error: ${error.message}`,
          data: { error: error.message }
        });
      }
      
      // Calculate summary
      const successfulTests = results.tests.filter(t => t.success).length;
      const totalTests = results.tests.length;
      
      results.summary = {
        total: totalTests,
        successful: successfulTests,
        failed: totalTests - successfulTests,
        successRate: totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(1) : 0
      };
      
      return NextResponse.json({
        success: true,
        message: 'Comprehensive gift card test completed',
        results: results
      });
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid test type. Use "comprehensive" for full test suite.'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Error in gift card test POST:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});