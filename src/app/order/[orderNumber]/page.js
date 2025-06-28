import { Suspense } from 'react';
import { OrderSuccessClient } from './OrderSuccessClient';
import { getOrder } from '@/lib/orders';

// Function to fetch product image from Shopify by variant ID
async function fetchProductImageByVariantId(variantId) {
  try {
    // Remove the 'gid://shopify/ProductVariant/' prefix if it exists
    const cleanVariantId = variantId.replace('gid://shopify/ProductVariant/', '');
    
    const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
      console.error('Missing Shopify environment variables');
      return null;
    }
    
    const query = `
      query getVariantImage($id: ID!) {
        productVariant(id: $id) {
          image {
            url
            altText
          }
          product {
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch(`https://${SHOPIFY_DOMAIN}.myshopify.com/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: { id: `gid://shopify/ProductVariant/${cleanVariantId}` }
      }),
    });
    
    if (!response.ok) {
      console.error('Shopify API error:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (data.errors) {
      console.error('Shopify GraphQL errors:', data.errors);
      return null;
    }
    
    const variant = data.data?.productVariant;
    if (!variant) {
      console.error('No variant found for ID:', variantId);
      return null;
    }
    
    // Use variant image if available, otherwise use first product image
    const imageUrl = variant.image?.url || variant.product?.images?.edges?.[0]?.node?.url;
    return imageUrl;
    
  } catch (error) {
    console.error('Error fetching product image:', error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { orderNumber } = params;
  
  // Fetch order data from database to get rich product information
  let orderData = null;
  let firstProductImage = null;
  let orderTotal = null;
  let productTitles = 'crypto merch';
  
  try {
    const orderResult = await getOrder(orderNumber);
    if (orderResult.success && orderResult.order) {
      orderData = orderResult.order;
      orderTotal = orderData.amount_total;
      
      // Get first product image and titles
      if (orderData.line_items && orderData.line_items.length > 0) {
        const firstItem = orderData.line_items[0];
        
        // Try to fetch product image from Shopify using variant ID
        if (firstItem.id) {
          firstProductImage = await fetchProductImageByVariantId(firstItem.id);
        }
        
        // Create a nice product list
        if (orderData.line_items.length === 1) {
          productTitles = firstItem.title;
        } else {
          productTitles = `${firstItem.title} + ${orderData.line_items.length - 1} more item${orderData.line_items.length > 2 ? 's' : ''}`;
        }
      }
    }
  } catch (error) {
    console.error('Error fetching order data for metadata:', error);
  }
  
  // Fix URL construction to avoid double slashes
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mintedmerch.vercel.app').replace(/\/$/, '');
  
  // Enhanced dynamic image URL with product information
  const imageParams = new URLSearchParams({
    orderNumber,
    total: orderTotal?.toString() || '0.00',
    products: productTitles,
    itemCount: orderData?.line_items?.length?.toString() || '1'
  });
  
  // Add first product image if available
  if (firstProductImage) {
    imageParams.set('image', firstProductImage);
  }
  
  const dynamicImageUrl = `${baseUrl}/api/og/order?${imageParams.toString()}`;
  
  // Create frame embed with dynamic order image - use version "next" for Mini App embeds
  const frame = {
    version: "next",
    imageUrl: dynamicImageUrl,
    button: {
      title: "Shop More Merch 🛒",
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
    title: `Order ${orderNumber} - Minted Merch Shop`,
    description: `Order confirmed! ${productTitles} purchased with USDC on Base.`,
    metadataBase: new URL(baseUrl),
    other: {
      'fc:frame': JSON.stringify(frame),
    },
    openGraph: {
      title: `Order ${orderNumber} - Minted Merch Shop`,
      description: `Order confirmed! ${productTitles} purchased with USDC on Base.`,
      siteName: 'Minted Merch Shop',
      images: [
        {
          url: dynamicImageUrl,
          width: 1200,
          height: 800,
          alt: `Order ${orderNumber} - Minted Merch Shop`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Order ${orderNumber} - Minted Merch Shop`,
      description: `Order confirmed! ${productTitles} purchased with USDC on Base.`,
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