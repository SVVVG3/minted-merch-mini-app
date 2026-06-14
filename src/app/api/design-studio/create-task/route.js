import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { createMockupTask, getPrintfiles } from '@/lib/printfulMockup';
import { getProductConfig } from '@/lib/designStudioConfig';

export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { productId, variantIds, imageUrl, position, placementStyle } = await request.json();

    const productConfig = getProductConfig(productId);
    if (!productConfig) {
      return NextResponse.json({ error: 'Invalid product selection' }, { status: 400 });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'Design image URL is required' }, { status: 400 });
    }

    if (!variantIds || variantIds.length === 0) {
      return NextResponse.json({ error: 'Color variant is required' }, { status: 400 });
    }

    // Always fetch printfiles to get:
    //  1. The correct placement name for this product (available_placements)
    //  2. Printfile dimensions for a fallback position when the client had no template
    let resolvedPlacement = productConfig.placement;
    let resolvedPosition = position || null;

    try {
      const printfilesData = await getPrintfiles(
        productConfig.printfulProductId,
        productConfig.technique || null
      );

      // Use the first key from available_placements as the authoritative placement name
      const availablePlacements = printfilesData?.available_placements || {};
      const placementKeys = Object.keys(availablePlacements);
      if (placementKeys.length > 0 && !placementKeys.includes(resolvedPlacement)) {
        resolvedPlacement = placementKeys[0];
        console.log(`📌 Overriding placement '${productConfig.placement}' → '${resolvedPlacement}' for ${productConfig.label}`);
      }

      // Build position from printfile dimensions if client didn't supply one
      if (!resolvedPosition) {
        const printfiles = printfilesData?.printfiles || [];
        if (printfiles.length > 0) {
          const pf = printfiles[0];
          const aw = pf.width;
          const ah = pf.height;

          if (placementStyle === 'leftchest') {
            const size = Math.round(aw * 0.28);
            resolvedPosition = {
              area_width: aw,
              area_height: ah,
              width: size,
              height: size,
              top: Math.round(ah * 0.05),
              left: Math.round(aw * 0.05),
            };
            console.log(`📐 Using left-chest position from printfile (${aw}×${ah}) for ${productConfig.label}`);
          } else {
            const size = Math.round(Math.min(aw, ah) * 0.9);
            resolvedPosition = {
              area_width: aw,
              area_height: ah,
              width: size,
              height: size,
              top: Math.round((ah - size) / 2),
              left: Math.round((aw - size) / 2),
            };
            console.log(`📐 Using default centered position from printfile (${aw}×${ah}) for ${productConfig.label}`);
          }
        }
      }
    } catch (pfError) {
      console.warn('Could not fetch printfiles:', pfError.message);
    }

    const payload = {
      variant_ids: variantIds,
      format: 'png',
      files: [
        {
          placement: resolvedPlacement,
          image_url: imageUrl,
          ...(resolvedPosition ? { position: resolvedPosition } : {}),
        },
      ],
    };
    // Note: product_options.technique is NOT a valid POST field for create-task.
    // The technique is specified via query param on the GET printfiles/templates endpoints only.

    const result = await createMockupTask(productConfig.printfulProductId, payload);

    console.log(`🎨 Mockup task created — FID: ${auth.fid}, product: ${productConfig.label}, task: ${result.task_key}`);

    return NextResponse.json({ success: true, taskKey: result.task_key, status: result.status });
  } catch (error) {
    console.error('Create mockup task error:', error);
    return NextResponse.json({ error: error.message || 'Failed to start mockup generation' }, { status: 500 });
  }
}
