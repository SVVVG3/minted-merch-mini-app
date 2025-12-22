import { Suspense } from 'react';
import { OrderSuccessClient } from './OrderSuccessClient';
import { getOrder } from '@/lib/orders';

// Function to fetch product image from Shopify by variant ID
async function getProductImageFromOrderItems(orderData) {
  try {
    if (!orderData?.line_items || orderData.line_items.length === 0) {
      console.log('No line items found in order');
      return `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
    }

    const firstItem = orderData.line_items[0];
    console.log('Getting image for product:', firstItem.title);

    // Check if we have a stored product image URL
    if (firstItem.imageUrl) {
      console.log('Using stored product image URL:', firstItem.imageUrl);
      return firstItem.imageUrl;
    }

    // Fallback to logo if no image URL is stored
    console.log('No product image URL found, using logo fallback');
    return `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
    
  } catch (error) {
    console.error('Error getting product image from order:', error);
    return `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
  }
}

export async function generateMetadata({ params, searchParams }) {
  const { orderNumber } = params;
  const cacheBust = searchParams?.t; // Cache-busting parameter from share button
  
  console.log('=== Order Page Metadata Generation ===');
  console.log('Order number:', orderNumber);
  console.log('Cache bust param:', cacheBust);
  
  // Fetch order data from database to get rich product information
  let orderData = null;
  let firstProductImage = null;
  let orderTotal = null;
  let productDescription = 'crypto merch';
  
  try {
    // Try different order number formats
    let searchOrderNumber = orderNumber;
    
    // First try with # prefix if not present
    if (!orderNumber.startsWith('#')) {
      searchOrderNumber = `#${orderNumber}`;
    }
    
    console.log('Searching for order:', searchOrderNumber);
    let orderResult = await getOrder(searchOrderNumber);
    
    // If not found with #, try without #
    if (!orderResult.success || !orderResult.order) {
      console.log('Order not found with #, trying without:', orderNumber);
      orderResult = await getOrder(orderNumber);
    }
    
    if (orderResult.success && orderResult.order) {
      orderData = orderResult.order;
      orderTotal = parseFloat(orderData.amount_total);
      
      console.log('Order found:', {
        orderId: orderData.order_id,
        total: orderData.amount_total,
        lineItemsCount: orderData.line_items?.length
      });
      
      // Get first product image and create product description
      if (orderData.line_items && orderData.line_items.length > 0) {
        const firstItem = orderData.line_items[0];
        
        console.log('First line item:', firstItem);
        
        // Get product image using reliable method
        firstProductImage = await getProductImageFromOrderItems(orderData);
        
        // Create product description based on item count
        const itemCount = orderData.line_items.length;
        if (itemCount === 1) {
          productDescription = `1 item`;
        } else {
          productDescription = `${itemCount} items`;
        }
      }
    } else {
      console.log('Order not found in database for either format:', { withHash: searchOrderNumber, withoutHash: orderNumber });
    }
  } catch (error) {
    console.error('Error fetching order data for metadata:', error);
  }
  
  // If we still don't have order data, provide generic fallback
  if (!orderData) {
    console.log('Order not found in database, using generic fallback for order:', orderNumber);
    orderTotal = 0.00;
    productDescription = '1 item';
    firstProductImage = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
  }
  
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
  
  // Simplified dynamic image URL - let the OG route fetch data from database
  // Use the actual order_id from database if available, otherwise format the orderNumber
  const displayOrderNumber = orderData?.order_id || (orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`);
  
  // Generate product list for OG image
  const productList = orderData?.line_items?.map(item => {
    const quantity = item.quantity || 1;
    const title = item.title || 'Item';
    return `${quantity}x ${title}`;
  }).join('\n') || '1 item';
  
  const imageParams = new URLSearchParams({
    orderNumber: displayOrderNumber,
    products: productList,
    total: orderData?.amount_total || '0.00'
  });
  
  // Add first product image if available
  if (firstProductImage) {
    imageParams.set('image', firstProductImage);
    console.log('✅ Adding product image to OG params:', firstProductImage);
  } else {
    console.log('⚠️ No product image found for order');
  }
  
  // Add cache-busting parameter if provided (for immediate shares)
  if (cacheBust) {
    imageParams.set('t', cacheBust);
    console.log('🔄 Adding cache-busting parameter:', cacheBust);
  }
  
  const dynamicImageUrl = `${baseUrl}/api/og/order?${imageParams.toString()}`;
  console.log('📸 Final OG image URL:', dynamicImageUrl);
  
  // Create frame embed with dynamic order image - use version "next" for Mini App embeds
  const frame = {
    version: "next",
    imageUrl: dynamicImageUrl,
    button: {
      title: "Shop Now 📦",
      action: {
        type: "launch_frame",
        url: baseUrl,
        name: "Minted Merch Shop",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#000000"
      }
    }
  };

  return {
    title: `Order ${orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`} - Minted Merch Shop`,
    description: `Order confirmed! ${productDescription} purchased with USDC on Base.`,
    metadataBase: new URL(baseUrl),
    other: {
      'fc:frame': JSON.stringify(frame),
    },
    openGraph: {
      title: `Order ${orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`} - Minted Merch Shop`,
      description: `Order confirmed! ${productDescription} purchased with USDC on Base.`,
      siteName: 'Minted Merch Shop',
      images: [
        {
          url: dynamicImageUrl,
          width: 1200,
          height: 800,
          alt: `Order ${orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`} - Minted Merch Shop`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Order ${orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`} - Minted Merch Shop`,
      description: `Order confirmed! ${productDescription} purchased with USDC on Base.`,
      images: [dynamicImageUrl],
    },
  };
}

// Force dynamic rendering to prevent caching issues
export const dynamic = 'force-dynamic';

export default function OrderPage({ params }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrderSuccessClient orderNumber={params.orderNumber} />
    </Suspense>
  );
} 