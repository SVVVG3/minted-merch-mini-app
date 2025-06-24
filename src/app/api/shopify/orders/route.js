import { createShopifyOrder, getOrderStatus } from '@/lib/shopifyAdmin';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      cartItems,
      shippingAddress,
      billingAddress,
      customer,
      checkout,
      selectedShipping,
      transactionHash,
      notes
    } = body;

    // Validate required fields
    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Cart items are required' },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      );
    }

    if (!transactionHash) {
      return NextResponse.json(
        { error: 'Transaction hash is required' },
        { status: 400 }
      );
    }

    if (!checkout || !checkout.subtotal || !checkout.tax || !selectedShipping) {
      return NextResponse.json(
        { error: 'Complete checkout data is required' },
        { status: 400 }
      );
    }

    // Format line items for Shopify
    const lineItems = cartItems.map(item => ({
      variantId: item.selectedVariant.id,
      quantity: item.quantity,
      price: parseFloat(item.selectedVariant.price.amount)
    }));

    // Calculate totals
    const subtotalPrice = parseFloat(checkout.subtotal.amount);
    const totalTax = parseFloat(checkout.tax.amount);
    const shippingPrice = parseFloat(selectedShipping.price.amount);
    const totalPrice = subtotalPrice + totalTax + shippingPrice;

    // Format shipping lines
    const shippingLines = {
      title: selectedShipping.title,
      price: shippingPrice,
      code: selectedShipping.code || selectedShipping.title
    };

    // Prepare order data for Shopify Admin API
    const orderData = {
      lineItems,
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
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
      subtotalPrice,
      totalTax,
      shippingLines,
      transactionHash,
      notes: notes || ''
    };

    console.log('Creating Shopify order with data:', {
      lineItems: lineItems.length,
      totalPrice,
      transactionHash,
      shippingAddress: shippingAddress.city
    });

    // Create order in Shopify
    const result = await createShopifyOrder(orderData);

    if (result.success) {
      console.log('Order created successfully:', result.order.name);
      
      return NextResponse.json({
        success: true,
        order: result.order,
        message: 'Order created successfully'
      });
    } else {
      console.error('Order creation failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to create order in Shopify' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Order creation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve order status
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const order = await getOrderStatus(orderId);

    return NextResponse.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Order status API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch order status',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 