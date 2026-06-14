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
          // Store all variant IDs for this color (different sizes)
          variantIds: [],
        });
      }
      colorMap.get(v.color).variantIds.push(v.id);
    });

    const colors = Array.from(colorMap.values());
    return NextResponse.json({ success: true, colors });
  } catch (error) {
    console.error('Variants fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
