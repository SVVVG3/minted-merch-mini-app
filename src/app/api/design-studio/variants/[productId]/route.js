import { NextResponse } from 'next/server';
import { getProductVariants } from '@/lib/printfulMockup';

// Public endpoint — no auth required (just catalog data)
export async function GET(request, { params }) {
  try {
    const { productId } = await params;
    const data = await getProductVariants(productId);

    const variants = data?.variants || [];

    // Group by color — one representative variant ID per color is enough for mockups
    const colorMap = new Map();
    variants.forEach(v => {
      if (!v.color || !v.color_code) return;
      if (!colorMap.has(v.color)) {
        colorMap.set(v.color, {
          name: v.color,
          code: v.color_code,
          variantIds: [],
          image: v.image || null, // first variant image for this color
        });
      }
      colorMap.get(v.color).variantIds.push(v.id);
    });

    const colors = Array.from(colorMap.values());

    // Return a representative product image — prefer black variant, fall back to first
    const blackVariant = variants.find(v => v.color?.toLowerCase() === 'black')
      || variants.find(v => v.color?.toLowerCase().includes('black'))
      || variants[0];
    const productImage = blackVariant?.image || data?.product?.image || null;

    return NextResponse.json({ success: true, colors, productImage });
  } catch (error) {
    console.error('Variants fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
