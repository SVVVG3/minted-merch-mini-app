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

  // Optional color filter — if provided, only return variants for that color
  const colorFilter = searchParams.get('color'); // e.g. "Black"

  try {
    // shopifyAdminFetch returns the raw GraphQL envelope { data: { product: … } }
    const raw = await shopifyAdminFetch(QUERY, { id: productId });
    const product = raw?.data?.product;

    if (!product) {
      console.error('shopify-variants: product not found in response', JSON.stringify(raw).slice(0, 200));
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let allVariants = (product.variants?.edges || []).map(({ node }) => ({
      id: node.id,                      // gid://shopify/ProductVariant/XXXX
      rawTitle: node.title,             // e.g. "Black / S" or "S"
      price: parseFloat(node.price),
      availableForSale: node.availableForSale,
    }));

    // Variants are titled "Color / Size" (e.g. "Black / S").
    // If a colorFilter is provided, keep only variants for that color and
    // strip the "Color / " prefix so the picker shows clean size labels.
    if (colorFilter) {
      const prefix = colorFilter.toLowerCase();
      const filtered = allVariants.filter(v =>
        v.rawTitle.toLowerCase().startsWith(prefix + ' / ') ||
        v.rawTitle.toLowerCase() === prefix
      );
      if (filtered.length > 0) {
        allVariants = filtered.map(v => ({
          ...v,
          title: v.rawTitle.includes(' / ') ? v.rawTitle.split(' / ').slice(1).join(' / ') : v.rawTitle,
        }));
      } else {
        // Color not found — fall back to stripping color prefix generically
        allVariants = allVariants.map(v => ({
          ...v,
          title: v.rawTitle.includes(' / ') ? v.rawTitle.split(' / ').slice(1).join(' / ') : v.rawTitle,
        }));
      }
    } else {
      // No color filter: just pass the rawTitle as title
      allVariants = allVariants.map(v => ({ ...v, title: v.rawTitle }));
    }

    // Remove rawTitle from response payload
    const variants = allVariants.map(({ rawTitle: _r, ...rest }) => rest);

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
