/**
 * Fetches real Shopify variant IDs + prices for a Design Studio custom product.
 * Used by the Buy sheet so we always pass the correct variant GID to checkout.
 *
 * GET /api/design-studio/shopify-variants?productId=gid://shopify/Product/XXXX
 */

import { NextResponse } from 'next/server';
import { shopifyAdminFetch } from '@/lib/shopifyAdmin';

const QUERY = `
  query getProductVariants($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      variants(first: 30) {
        edges {
          node {
            id
            title
            price
            availableForSale
          }
        }
      }
    }
  }
`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 });
  }

  try {
    const data = await shopifyAdminFetch(QUERY, { id: productId });
    const product = data?.product;

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const variants = (product.variants?.edges || []).map(({ node }) => ({
      id: node.id,                      // gid://shopify/ProductVariant/XXXX
      title: node.title,                // "S", "M", "L" etc. (or "Default Title")
      price: parseFloat(node.price),
      availableForSale: node.availableForSale,
    }));

    return NextResponse.json({
      productId: product.id,
      title: product.title,
      handle: product.handle,
      variants,
    });
  } catch (err) {
    console.error('❌ shopify-variants fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
