import { createShopifyOrder } from '@/lib/shopifyAdmin';
import { createOrder as createSupabaseOrder } from '@/lib/orders';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { testOrderData, skipShopify = false, skipSupabase = false } = body;
    
    console.log('🔍 DEBUG: Starting order creation debug process');
    console.log('🔍 DEBUG: Input data received:', JSON.stringify(testOrderData, null, 2));
    
    const results = {
      timestamp: new Date().toISOString(),
      input: testOrderData,
      validationResults: {},
      shopifyResults: {},
      supabaseResults: {},
      errors: [],
      warnings: []
    };

    // Step 1: Validate required fields
    console.log('🔍 DEBUG: Step 1 - Validating required fields');
    try {
      const validation = validateOrderData(testOrderData);
      results.validationResults = validation;
      
      if (!validation.isValid) {
        results.errors.push(`Validation failed: ${validation.errors.join(', ')}`);
        return NextResponse.json(results);
      }
    } catch (error) {
      results.errors.push(`Validation error: ${error.message}`);
      return NextResponse.json(results);
    }

    // Step 2: Test Shopify order creation
    if (!skipShopify) {
      console.log('🔍 DEBUG: Step 2 - Testing Shopify order creation');
      try {
        const shopifyOrderData = prepareShopifyOrderData(testOrderData);
        console.log('🔍 DEBUG: Shopify order data prepared:', JSON.stringify(shopifyOrderData, null, 2));
        
        results.shopifyResults.preparedData = shopifyOrderData;
        
        const shopifyResult = await createShopifyOrder(shopifyOrderData);
        results.shopifyResults.result = shopifyResult;
        
        if (shopifyResult.success) {
          console.log('✅ DEBUG: Shopify order created successfully:', shopifyResult.order.name);
          results.shopifyResults.success = true;
          results.shopifyResults.orderName = shopifyResult.order.name;
          results.shopifyResults.orderId = shopifyResult.order.id;
        } else {
          console.log('❌ DEBUG: Shopify order creation failed:', shopifyResult.error);
          results.shopifyResults.success = false;
          results.errors.push(`Shopify creation failed: ${shopifyResult.error}`);
        }
      } catch (error) {
        console.error('❌ DEBUG: Shopify creation threw error:', error);
        results.shopifyResults.success = false;
        results.shopifyResults.error = error.message;
        results.shopifyResults.stack = error.stack;
        results.errors.push(`Shopify error: ${error.message}`);
      }
    }

    // Step 3: Test Supabase order creation
    if (!skipSupabase && (!testOrderData.requireShopifySuccess || results.shopifyResults.success)) {
      console.log('🔍 DEBUG: Step 3 - Testing Supabase order creation');
      try {
        const supabaseOrderData = prepareSupabaseOrderData(testOrderData, results.shopifyResults);
        console.log('🔍 DEBUG: Supabase order data prepared:', JSON.stringify(supabaseOrderData, null, 2));
        
        results.supabaseResults.preparedData = supabaseOrderData;
        
        const supabaseResult = await createSupabaseOrder(supabaseOrderData);
        results.supabaseResults.result = supabaseResult;
        
        if (supabaseResult.success) {
          console.log('✅ DEBUG: Supabase order created successfully:', supabaseResult.order.order_id);
          results.supabaseResults.success = true;
          results.supabaseResults.orderId = supabaseResult.order.order_id;
        } else {
          console.log('❌ DEBUG: Supabase order creation failed:', supabaseResult.error);
          results.supabaseResults.success = false;
          results.errors.push(`Supabase creation failed: ${supabaseResult.error}`);
        }
      } catch (error) {
        console.error('❌ DEBUG: Supabase creation threw error:', error);
        results.supabaseResults.success = false;
        results.supabaseResults.error = error.message;
        results.supabaseResults.stack = error.stack;
        results.errors.push(`Supabase error: ${error.message}`);
      }
    }

    // Step 4: Summary analysis
    results.summary = {
      allStepsSuccessful: results.validationResults.isValid && 
                         (skipShopify || results.shopifyResults.success) && 
                         (skipSupabase || results.supabaseResults.success),
      criticalErrors: results.errors.length,
      recommendedActions: generateRecommendations(results)
    };

    console.log('🔍 DEBUG: Final results:', JSON.stringify(results.summary, null, 2));
    
    return NextResponse.json(results);
    
  } catch (error) {
    console.error('❌ DEBUG: Top-level error in debug endpoint:', error);
    return NextResponse.json({
      error: 'Debug endpoint failed',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function validateOrderData(orderData) {
  const errors = [];
  const warnings = [];
  
  // Required fields validation
  if (!orderData.cartItems || orderData.cartItems.length === 0) {
    errors.push('cartItems is required and must not be empty');
  }
  
  if (!orderData.shippingAddress) {
    errors.push('shippingAddress is required');
  } else {
    const addr = orderData.shippingAddress;
    if (!addr.firstName) errors.push('shippingAddress.firstName is required');
    if (!addr.lastName) errors.push('shippingAddress.lastName is required');
    if (!addr.address1) errors.push('shippingAddress.address1 is required');
    if (!addr.city) errors.push('shippingAddress.city is required');
    if (!addr.province) errors.push('shippingAddress.province is required');
    if (!addr.zip) errors.push('shippingAddress.zip is required');
    if (!addr.country) errors.push('shippingAddress.country is required');
  }
  
  if (!orderData.checkout) {
    errors.push('checkout data is required');
  } else {
    if (!orderData.checkout.subtotal) errors.push('checkout.subtotal is required');
    if (!orderData.checkout.tax) errors.push('checkout.tax is required');
  }
  
  if (!orderData.selectedShipping) {
    errors.push('selectedShipping is required');
  }
  
  if (!orderData.transactionHash) {
    errors.push('transactionHash is required');
  }
  
  if (!orderData.customer || !orderData.customer.email) {
    warnings.push('customer.email missing - order tracking may be affected');
  }
  
  // Cart items validation
  if (orderData.cartItems) {
    orderData.cartItems.forEach((item, index) => {
      if (!item.variant || !item.variant.id) {
        errors.push(`cartItems[${index}].variant.id is required`);
      }
      if (!item.product || !item.product.title) {
        errors.push(`cartItems[${index}].product.title is required`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`cartItems[${index}].quantity must be > 0`);
      }
      if (!item.price && !item.variant?.price?.amount) {
        errors.push(`cartItems[${index}] missing price information`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fieldsChecked: [
      'cartItems', 'shippingAddress', 'checkout', 'selectedShipping', 
      'transactionHash', 'customer', 'line item validation'
    ]
  };
}

function prepareShopifyOrderData(orderData) {
  const {
    cartItems,
    shippingAddress,
    billingAddress,
    customer,
    checkout,
    selectedShipping,
    transactionHash,
    notes = '',
    appliedDiscount,
    discountAmount
  } = orderData;

  // Format line items for Shopify
  const lineItems = cartItems.map((item, index) => {
    const price = item.variant.price?.amount ? parseFloat(item.variant.price.amount) : parseFloat(item.price);
    
    return {
      variantId: item.variant.id,
      quantity: item.quantity,
      price: price,
      // Keep product info for internal use, but don't pass to Shopify API
      productTitle: item.product.title
    };
  });

  // Calculate totals with discount - FIXED to prevent negative subtotals
  const subtotalPrice = parseFloat(checkout.subtotal.amount);
  const discountAmountValue = discountAmount ? parseFloat(discountAmount) : 0;
  const subtotalAfterDiscount = Math.max(0, subtotalPrice - discountAmountValue);
  const totalTax = parseFloat(checkout.tax.amount);
  const shippingPrice = parseFloat(selectedShipping.price.amount);
  const totalPrice = subtotalAfterDiscount + totalTax + shippingPrice;

  return {
    lineItems,
    shippingAddress: {
      firstName: shippingAddress.firstName,
      lastName: shippingAddress.lastName,
      address1: shippingAddress.address1,
      address2: shippingAddress.address2 || '',
      city: shippingAddress.city,
      province: shippingAddress.province, // Fix: use province instead of state
      zip: shippingAddress.zip,
      country: shippingAddress.country,
      phone: shippingAddress.phone || ''
    },
    billingAddress: billingAddress || null,
    customer: {
      email: customer?.email || shippingAddress.email || '',
      phone: customer?.phone || shippingAddress.phone || ''
    },
    totalPrice,
    subtotalPrice: subtotalAfterDiscount,
    totalTax,
    shippingLines: {
      title: selectedShipping.title,
      price: shippingPrice,
      code: selectedShipping.code || selectedShipping.title
    },
    transactionHash,
    notes,
    discountCodes: appliedDiscount ? [{
      code: appliedDiscount.code,
      amount: discountAmountValue,
      type: appliedDiscount.discountType
    }] : []
  };
}

function prepareSupabaseOrderData(orderData, shopifyResults) {
  const {
    cartItems,
    shippingAddress,
    customer,
    checkout,
    selectedShipping,
    transactionHash,
    fid,
    appliedDiscount,
    discountAmount
  } = orderData;

  const subtotalPrice = parseFloat(checkout.subtotal.amount);
  const discountAmountValue = discountAmount ? parseFloat(discountAmount) : 0;
  const subtotalAfterDiscount = subtotalPrice - discountAmountValue;
  const totalTax = parseFloat(checkout.tax.amount);
  const shippingPrice = parseFloat(selectedShipping.price.amount);
  const totalPrice = subtotalAfterDiscount + totalTax + shippingPrice;

  return {
    fid: fid || null,
    orderId: shopifyResults?.orderName || `DEBUG-${Date.now()}`,
    sessionId: null,
    status: 'paid',
    currency: 'USDC',
    amountTotal: totalPrice,
    amountSubtotal: subtotalAfterDiscount,
    amountTax: totalTax,
    amountShipping: shippingPrice,
    discountCode: appliedDiscount?.code || null,
    discountAmount: discountAmountValue,
    discountPercentage: appliedDiscount?.discountValue || null,
    customerEmail: customer?.email || shippingAddress.email || '',
    customerName: shippingAddress.firstName ? 
      `${shippingAddress.firstName} ${shippingAddress.lastName || ''}`.trim() : 
      (customer?.email || shippingAddress.email || ''),
    shippingAddress: shippingAddress,
    shippingMethod: selectedShipping.title || 'Standard',
    lineItems: cartItems.map(item => {
      const productImageUrl = item.product?.image?.url || null;
      
      return {
        id: item.variant.id,
        title: item.product.title,
        quantity: item.quantity,
        price: item.variant.price?.amount ? parseFloat(item.variant.price.amount) : parseFloat(item.price),
        variant: item.variant?.title !== 'Default Title' ? item.variant?.title : null,
        imageUrl: productImageUrl
      };
    }),
    paymentMethod: 'USDC',
    paymentStatus: 'completed',
    paymentIntentId: transactionHash
  };
}

function generateRecommendations(results) {
  const recommendations = [];
  
  if (!results.validationResults.isValid) {
    recommendations.push('Fix validation errors before proceeding');
  }
  
  if (results.shopifyResults && !results.shopifyResults.success) {
    recommendations.push('Check Shopify Admin API configuration and line item data structure');
  }
  
  if (results.supabaseResults && !results.supabaseResults.success) {
    recommendations.push('Check Supabase database connection and table schema');
  }
  
  if (results.errors.some(e => e.includes('variant'))) {
    recommendations.push('Verify product variant IDs are valid and exist in Shopify');
  }
  
  if (results.errors.some(e => e.includes('price'))) {
    recommendations.push('Check price formatting and currency handling');
  }
  
  if (results.errors.some(e => e.includes('address'))) {
    recommendations.push('Verify shipping address format and required fields');
  }
  
  return recommendations;
}

export async function GET() {
  return NextResponse.json({
    message: 'Order Creation Debug Endpoint',
    description: 'POST order data here to debug the creation process',
    expectedPayload: {
      testOrderData: {
        cartItems: '// Array of cart items',
        shippingAddress: '// Shipping address object',
        customer: '// Customer information',
        checkout: '// Checkout totals',
        selectedShipping: '// Selected shipping method',
        transactionHash: '// USDC transaction hash',
        fid: '// Optional Farcaster ID',
        appliedDiscount: '// Optional discount information'
      },
      skipShopify: 'boolean // Skip Shopify creation test',
      skipSupabase: 'boolean // Skip Supabase creation test'
    }
  });
} 