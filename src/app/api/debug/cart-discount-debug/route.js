import { NextResponse } from 'next/server';
import { getUserAvailableDiscounts } from '@/lib/discounts';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  const { searchParams } = new URL(request.url);
  const fid = parseInt(searchParams.get('fid')) || 18949;
  
  try {
    // Simulate the user's exact cart
    const testCart = {
      items: [
        { 
          product: { handle: 'gdupi-cap', title: 'Gdupi Cap' }, 
          price: 29.97, 
          quantity: 1,
          key: 'gdupi-cap-1'
        },
        { 
          product: { handle: 'make-america-based-again-cap', title: 'Make America Based Again Cap' }, 
          price: 33.00, 
          quantity: 1,
          key: 'make-america-based-again-cap-1'
        },
        { 
          product: { handle: 'bankr-bag', title: 'Bankr Bag' }, 
          price: 50.00, 
          quantity: 1,
          key: 'bankr-bag-1'
        }
      ]
    };
    
    const cartSubtotal = testCart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    // Get user's available discounts
    const userDiscountsResponse = await fetch(`${request.nextUrl.origin}/api/user-discounts?fid=${fid}`);
    const userDiscountsData = await userDiscountsResponse.json();
    
    let result = {
      fid,
      cartSubtotal,
      cartItems: testCart.items.map(item => ({
        handle: item.product.handle,
        title: item.product.title,
        price: item.price,
        quantity: item.quantity
      })),
      userDiscounts: userDiscountsData
    };
    
    if (userDiscountsData.success && userDiscountsData.categorized?.usable) {
      const usableDiscounts = userDiscountsData.categorized.usable;
      
      // For each discount, check if it applies to the cart
      const discountAnalysis = usableDiscounts.map(discount => {
        const isProductSpecific = discount.target_products && discount.target_products.length > 0;
        
        let qualifyingSubtotal = 0;
        let qualifyingItems = [];
        
        if (isProductSpecific) {
          // Check which items qualify
          testCart.items.forEach(item => {
            const productHandle = item.product?.handle;
            const productTitle = item.product?.title;
            
            const qualifies = discount.target_products.some(target => {
              if (productHandle && productHandle === target) return true;
              if (productTitle && productTitle.toLowerCase().includes(target.toLowerCase())) return true;
              return false;
            });
            
            if (qualifies) {
              qualifyingSubtotal += (item.price * item.quantity);
              qualifyingItems.push({
                handle: productHandle,
                title: productTitle,
                price: item.price,
                quantity: item.quantity,
                lineTotal: item.price * item.quantity
              });
            }
          });
        } else {
          // Site-wide discount
          qualifyingSubtotal = cartSubtotal;
          qualifyingItems = testCart.items.map(item => ({
            handle: item.product.handle,
            title: item.product.title,
            price: item.price,
            quantity: item.quantity,
            lineTotal: item.price * item.quantity
          }));
        }
        
        // Calculate discount amount
        let discountAmount = 0;
        if (discount.discount_type === 'percentage') {
          discountAmount = (qualifyingSubtotal * discount.discount_value) / 100;
        } else if (discount.discount_type === 'fixed') {
          discountAmount = Math.min(discount.discount_value, qualifyingSubtotal);
        }
        
        return {
          code: discount.code,
          description: discount.description,
          discountType: discount.discount_type,
          discountValue: discount.discount_value,
          priorityLevel: discount.priority_level,
          isProductSpecific,
          targetProducts: discount.target_products,
          qualifyingSubtotal,
          qualifyingItems,
          discountAmount,
          finalTotal: cartSubtotal - discountAmount
        };
      });
      
      // Sort by priority and discount value
      const sortedDiscounts = discountAnalysis.sort((a, b) => {
        const priorityA = a.priorityLevel || 0;
        const priorityB = b.priorityLevel || 0;
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        
        return (b.discountValue || 0) - (a.discountValue || 0);
      });
      
      result.discountAnalysis = sortedDiscounts;
      result.bestDiscount = sortedDiscounts[0];
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});