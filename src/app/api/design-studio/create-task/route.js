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
    // Accept designScale and designPlacement from the client instead of a pre-built
    // position object. Position is always computed server-side from Printful's
    // printfiles endpoint — this guarantees we use the correct printfile coordinate
    // system and eliminates client/template-pixel vs printfile-pixel mismatches.
    const { productId, variantIds, imageUrl, designScale, designPlacement } = await request.json();

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

    // ── Fetch printfiles — authoritative source for placement name & dimensions ──
    let resolvedPlacement = productConfig.placement;
    let resolvedPosition = null;

    try {
      const printfilesData = await getPrintfiles(
        productConfig.printfulProductId,
        productConfig.technique || null
      );

      // Override placement if the configured name isn't in available_placements
      const availablePlacements = printfilesData?.available_placements || {};
      const placementKeys = Object.keys(availablePlacements);
      if (placementKeys.length > 0 && !placementKeys.includes(resolvedPlacement)) {
        resolvedPlacement = placementKeys[0];
        console.log(`📌 Placement '${productConfig.placement}' → '${resolvedPlacement}' for ${productConfig.label}`);
      }

      // Compute position from printfile pixel dimensions
      const printfiles = printfilesData?.printfiles || [];
      if (printfiles.length > 0) {
        const pf = printfiles[0];
        const aw = pf.width;
        const ah = pf.height;

        if (designPlacement === 'leftchest' && productConfig.id !== 'hat') {
          // "Left chest" = wearer's LEFT chest = viewer's RIGHT side of the template image.
          // Position: upper-right quadrant, roughly 60% from left edge.
          const size = Math.round(Math.min(aw, ah) * 0.28);
          resolvedPosition = {
            area_width: aw,
            area_height: ah,
            width: size,
            height: size,
            top: Math.round(ah * 0.08),   // ~8% from top of print area
            left: Math.round(aw * 0.62),   // ~62% from left = viewer's right
          };
          console.log(`📐 Left-chest position (${aw}×${ah}): size=${size}, top=${resolvedPosition.top}, left=${resolvedPosition.left}`);
        } else {
          // Centered full-front (or hat embroidery)
          const scale = typeof designScale === 'number' && designScale > 0
            ? designScale
            : (productConfig.defaultScale ?? (productConfig.technique === 'EMBROIDERY' ? 0.45 : 0.85));
          const size = Math.round(Math.min(aw, ah) * scale);
          resolvedPosition = {
            area_width: aw,
            area_height: ah,
            width: size,
            height: size,
            top: Math.round((ah - size) / 2),
            left: Math.round((aw - size) / 2),
          };
          console.log(`📐 Centered position (scale=${scale}, ${aw}×${ah}): size=${size}`);
        }
      }
    } catch (pfError) {
      console.error('Printfiles fetch failed:', pfError.message);
      // Without printfile dims we cannot safely build a position — surface the error
      return NextResponse.json(
        { error: `Could not load product print specs: ${pfError.message}` },
        { status: 502 }
      );
    }

    if (!resolvedPosition) {
      return NextResponse.json(
        { error: 'Could not determine design position (empty printfiles response)' },
        { status: 500 }
      );
    }

    const payload = {
      variant_ids: variantIds,
      format: 'png',
      files: [
        {
          placement: resolvedPlacement,
          image_url: imageUrl,
          position: resolvedPosition,
        },
      ],
    };

    const result = await createMockupTask(productConfig.printfulProductId, payload);

    console.log(`🎨 Mockup task created — FID: ${auth.fid}, product: ${productConfig.label}, placement: ${designPlacement || 'center'}, task: ${result.task_key}`);

    return NextResponse.json({ success: true, taskKey: result.task_key, status: result.status });
  } catch (error) {
    console.error('Create mockup task error:', error);
    return NextResponse.json({ error: error.message || 'Failed to start mockup generation' }, { status: 500 });
  }
}
