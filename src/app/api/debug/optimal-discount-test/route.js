import { NextResponse } from 'next/server';
import { getUserAvailableDiscounts } from '@/lib/discounts';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fid = parseInt(searchParams.get('fid')) || 18949;
  
  // Test cart scenarios
  const testCarts = [
    {
      name: 'Bankr Bag Only',
      items: [
        { product: { handle: 'bankr-bag', title: 'Bankr Bag' }, price: 50, quantity: 1 }
      ]
    },
    {
      name: 'Mixed Cart with Bankr Bag',
      items: [
        { product: { handle: 'bankr-bag', title: 'Bankr Bag' }, price: 50, quantity: 1 },
        { product: { handle: 'gdupi-cap', title: 'Gdupi Cap' }, price: 29.97, quantity: 1 }
      ]
    },
    {
      name: 'No Qualifying Products',
      items: [
        { product: { handle: 'random-product', title: 'Random Product' }, price: 25, quantity: 1 }
      ]
    }
  ];
  
  try {
    // Get user's available discounts
    const userDiscountsResponse = await getUserAvailableDiscounts(fid, false);
    
    if (!userDiscountsResponse.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get user discounts',
        details: userDiscountsResponse.error
      });
    }
    
    const eligibleDiscounts = userDiscountsResponse.categorized.usable;
    
    // Test each cart scenario
    const results = [];
    
    for (const testCart of testCarts) {
      // Filter discounts relevant to this cart
      const cartRelevantDiscounts = eligibleDiscounts.filter(discount => {
        // Site-wide discounts always apply
        if (discount.discount_scope === 'site_wide' || !discount.target_products || discount.target_products.length === 0) {
          return true;
        }
        
        // Product-specific discounts - check if any cart items qualify
        if (discount.target_products && discount.target_products.length > 0) {
          const hasQualifyingProduct = testCart.items.some(item => {
            const productHandle = item.product?.handle;
            const productTitle = item.product?.title;
            
            return discount.target_products.some(target => {
              if (productHandle && productHandle === target) return true;
              if (productTitle && productTitle.toLowerCase().includes(target.toLowerCase())) return true;
              return false;
            });
          });
          
          return hasQualifyingProduct;
        }
        
        return false;
      });
      
      // Sort by priority_level (higher first), then by discount_value (higher first)
      const sortedDiscounts = cartRelevantDiscounts.sort((a, b) => {
        const priorityA = a.priority_level || 0;
        const priorityB = b.priority_level || 0;
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
        
        // If same priority, prefer higher discount value
        return (b.discount_value || 0) - (a.discount_value || 0);
      });
      
      const bestDiscount = sortedDiscounts[0];
      
      // Calculate discount amount
      let discountAmount = 0;
      if (bestDiscount) {
        const cartSubtotal = testCart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
        
        if (bestDiscount.target_products && bestDiscount.target_products.length > 0) {
          // Product-specific discount
          let qualifyingSubtotal = 0;
          testCart.items.forEach(item => {
            const productHandle = item.product?.handle;
            const productTitle = item.product?.title;
            
            const qualifies = bestDiscount.target_products.some(target => {
              if (productHandle && productHandle === target) return true;
              if (productTitle && productTitle.toLowerCase().includes(target.toLowerCase())) return true;
              return false;
            });
            
            if (qualifies) {
              qualifyingSubtotal += (item.price * item.quantity);
            }
          });
          
          if (bestDiscount.discount_type === 'percentage') {
            discountAmount = (qualifyingSubtotal * bestDiscount.discount_value) / 100;
          } else {
            discountAmount = Math.min(bestDiscount.discount_value, qualifyingSubtotal);
          }
        } else {
          // Site-wide discount
          if (bestDiscount.discount_type === 'percentage') {
            discountAmount = (cartSubtotal * bestDiscount.discount_value) / 100;
          } else {
            discountAmount = Math.min(bestDiscount.discount_value, cartSubtotal);
          }
        }
      }
      
      results.push({
        cartName: testCart.name,
        cartSubtotal: testCart.items.reduce((total, item) => total + (item.price * item.quantity), 0),
        items: testCart.items.map(item => ({ 
          handle: item.product.handle, 
          title: item.product.title, 
          price: item.price 
        })),
        relevantDiscounts: cartRelevantDiscounts.map(d => ({
          code: d.code,
          discount_value: d.discount_value,
          discount_type: d.discount_type,
          discount_scope: d.discount_scope,
          target_products: d.target_products,
          priority_level: d.priority_level
        })),
        bestDiscount: bestDiscount ? {
          code: bestDiscount.code,
          discount_value: bestDiscount.discount_value,
          discount_type: bestDiscount.discount_type,
          discount_scope: bestDiscount.discount_scope,
          target_products: bestDiscount.target_products,
          priority_level: bestDiscount.priority_level
        } : null,
        discountAmount: discountAmount,
        finalTotal: testCart.items.reduce((total, item) => total + (item.price * item.quantity), 0) - discountAmount
      });
    }
    
    return NextResponse.json({
      success: true,
      userFid: fid,
      totalAvailableDiscounts: eligibleDiscounts.length,
      availableDiscounts: eligibleDiscounts.map(d => ({
        code: d.code,
        discount_value: d.discount_value,
        discount_type: d.discount_type,
        discount_scope: d.discount_scope,
        target_products: d.target_products,
        priority_level: d.priority_level
      })),
      testResults: results
    });
    
  } catch (error) {
    console.error('Error in optimal discount test:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
} 