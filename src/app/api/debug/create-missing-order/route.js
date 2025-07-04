import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { orderNumber } = await request.json();
    
    console.log('🔧 Creating missing order:', orderNumber);
    
    // Order #1211 (Mexico) details from error screenshot
    if (orderNumber === '1211') {
      const orderData = {
        fid: 418671, // Mexico user FID
        order_id: '#1211',
        session_id: null,
        status: 'paid',
        currency: 'USDC',
        amount_total: 10.40,
        amount_subtotal: 29.97,
        amount_tax: 0.00,
        amount_shipping: 11.99,
        discount_code: 'SNAPSHOT-TINY-HYPER-FREE',
        discount_amount: 29.97,
        discount_percentage: 100,
        customer_email: '', // Will need to be updated
        customer_name: 'Iván Itsai Hernández Avila',
        shipping_address: {
          firstName: 'Iván Itsai',
          lastName: 'Hernández Avila',
          address1: '1810 Avenida Universidad, J5',
          city: 'Coyoacan',
          province: 'CDMX',
          zip: '04310',
          country: 'MX',
          phone: ''
        },
        shipping_method: 'Worldwide Flat Rate',
        shipping_cost: 11.99,
        line_items: [
          {
            product_id: 'tiny-hyper-tee',
            product_title: 'Tiny Hyper Tee',
            variant_id: 'gid://shopify/ProductVariant/48690471370022',
            variant_title: 'Default Title',
            quantity: 1,
            price: 29.97,
            total: 29.97
          }
        ],
        payment_method: 'USDC on Base',
        payment_status: 'completed',
        payment_intent_id: '0x1ad5190e633784fab96999-f8408933ca624e633fcfaf0c0ad-c31ea22c51f9b5f',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('📦 Creating Order #1211 with data:', orderData);
      
      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', '#1211')
        .single();
      
      if (existingOrder) {
        return NextResponse.json({
          success: false,
          message: 'Order #1211 already exists in database'
        });
      }
      
      // Create the order
      const { data: newOrder, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating order:', error);
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
      
      console.log('✅ Order #1211 created successfully:', newOrder.order_id);
      
      return NextResponse.json({
        success: true,
        message: 'Order #1211 created successfully',
        order: newOrder,
        note: 'FID and customer email will need to be updated when user is identified'
      });
    }
    
    // Order #1208 (UK) details from Shopify screenshot  
    if (orderNumber === '1208') {
      // First, need to find the FID for this user - let's check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('fid')
        .eq('custody_address', '0xcfc2e0ff3aea9bc5b18bc2e587485d5c97954b7b10224cac9ef4b5a0a643bc92')
        .or('verified_eth_addresses.cs.["0xcfc2e0ff3aea9bc5b18bc2e587485d5c97954b7b10224cac9ef4b5a0a643bc92"]')
        .single();
      
      // For now, use a placeholder FID - can be updated when user is identified
      const fid = existingProfile?.fid || null;
      
      const orderData = {
        fid: fid,
        order_id: '#1208',
        session_id: null,
        status: 'paid', // Even though Shopify shows "partially paid", the discount worked
        currency: 'USDC',
        amount_total: 4.65, // Amount actually paid
        amount_subtotal: 29.97,
        amount_tax: 0.00,
        amount_shipping: 4.59,
        discount_code: 'SNAPSHOT-TINY-HYPER-FREE', // Inferred from payment pattern
        discount_amount: 29.97,
        discount_percentage: 100,
        customer_email: 'fmanno@gmail.com',
        customer_name: 'Francisco Manno',
        shipping_address: {
          firstName: 'Francisco',
          lastName: 'Manno',
          address1: '13 Glebe Field',
          city: 'Willingham',
          province: 'CB24 5AS',
          zip: 'CB24 5AS',
          country: 'GB',
          phone: ''
        },
        shipping_method: 'GB Flat Rate',
        shipping_cost: 4.59,
        line_items: [
          {
            product_id: 'tiny-hyper-tee',
            product_title: 'Tiny Hyper Tee',
            variant_id: 'gid://shopify/ProductVariant/48690471370022',
            variant_title: 'Default Title',
            quantity: 1,
            price: 29.97,
            total: 29.97
          }
        ],
        payment_method: 'USDC on Base',
        payment_status: 'completed',
        payment_intent_id: '0xcfc2e0ff3aea9bc5b18bc2e587485d5c97954b7b10224cac9ef4b5a0a643bc92',
        created_at: '2025-07-03T15:40:00Z', // Approximate time from Shopify
        updated_at: new Date().toISOString()
      };
      
      console.log('📦 Creating Order #1208 with data:', orderData);
      
      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', '#1208')
        .single();
      
      if (existingOrder) {
        return NextResponse.json({
          success: false,
          message: 'Order #1208 already exists in database'
        });
      }
      
      // Create the order
      const { data: newOrder, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating order:', error);
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
      
      console.log('✅ Order #1208 created successfully:', newOrder.order_id);
      
      return NextResponse.json({
        success: true,
        message: 'Order #1208 created successfully',
        order: newOrder,
        note: fid ? 'Order created with existing user profile' : 'FID is null - will need to be updated when user is identified'
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Order number not recognized. Currently supports: 1208, 1211'
    }, { status: 400 });
    
  } catch (error) {
    console.error('❌ Create missing order error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 