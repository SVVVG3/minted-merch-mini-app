import { Suspense } from 'react';
import { OrderSuccessClient } from './OrderSuccessClient';
import { getOrder } from '@/lib/orders';

// Function to fetch product image from Shopify by variant ID
async function getProductImageFromOrderItems(orderData) {
  try {
    if (!orderData?.line_items || orderData.line_items.length === 0) {
      console.log('No line items found in order');
      return null;
    }

    const firstItem = orderData.line_items[0];
    console.log('Getting image for product:', firstItem.title);

    // For now, use a reliable fallback approach
    // In the future, we should store product images directly in the order data
    
    // Always use the logo as a reliable fallback
    // This ensures the embed always has an image and works consistently
    console.log('Using logo as product image for reliable display');
    return 'https://mintedmerch.vercel.app/logo.png';
    
  } catch (error) {
    console.error('Error getting product image from order:', error);
    return 'https://mintedmerch.vercel.app/logo.png';
  }
}

export async function generateMetadata({ params }) {
  const { orderNumber } = params;
  
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
    firstProductImage = 'https://mintedmerch.vercel.app/logo.png';
  }
  
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app').replace(/\/$/, '');
  
  // Enhanced dynamic image URL with product information
  // Use the actual order_id from database if available, otherwise format the orderNumber
  const displayOrderNumber = orderData?.order_id || (orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`);
  
  const imageParams = new URLSearchParams({
    orderNumber: displayOrderNumber,
    total: orderTotal?.toString() || '0.00',
    products: productDescription,
    itemCount: orderData?.line_items?.length?.toString() || '1'
  });
  
  // Add first product image if available
  if (firstProductImage) {
    imageParams.set('image', firstProductImage);
  }
  
  const dynamicImageUrl = `${baseUrl}/api/og/order?${imageParams.toString()}`;
  
  console.log('Generated OG image URL:', dynamicImageUrl);
  
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
        splashBackgroundColor: "#1a1a1a"
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