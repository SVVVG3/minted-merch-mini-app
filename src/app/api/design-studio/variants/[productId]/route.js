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

    let colors = Array.from(colorMap.values());

    // All-over print products (e.g. bandana, pet collar) have size-only variants with no
    // color/color_code. Collect all variant IDs under a single synthetic entry so the
    // rest of the flow (loadTemplate, handleGenerate) still gets valid variantIds.
    if (colors.length === 0 && variants.length > 0) {
      colors = [{
        name: 'All-Over Print',
        code: '#ffffff',
        variantIds: variants.map(v => v.id),
        image: variants[0]?.image || null,
      }];
    }

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
