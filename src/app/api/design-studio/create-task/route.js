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
    // technique is optional — lets the client override the config (e.g. hoodie DTG vs EMBROIDERY)
    // fillPrintArea: true when the imageUrl is a pre-built tile composite that matches the
    // print-area aspect ratio (from buildTiledImageUrl). False for single-image uploads.
    const { productId, variantIds, imageUrl, designScale, designPlacement, technique, designOffsetX, designOffsetY, fillPrintArea, imageAspect } = await request.json();

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
    // Use product-specific Printful technique when available (e.g. CUT-SEW for bandana,
    // SUBLIMATION for pet collar). DTG is Printful's default so we pass null for it.
    const rawTechnique = productConfig.printfulTechnique || technique || productConfig.technique || null;
    const effectiveTechnique = (rawTechnique === 'DTG') ? null : rawTechnique;
    let resolvedPlacement = productConfig.placement;
    let resolvedPosition = null;

    try {
      const printfilesData = await getPrintfiles(
        productConfig.printfulProductId,
        effectiveTechnique
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

        // All-over print handling:
        //
        // CUT-SEW (bandana): printfile canvas is wider than the square product due to seam
        //   allowances, so always use Math.min(aw, ah) to keep the design proportional.
        //
        // SUBLIMATION single image (pet collar): design is a square upload on a landscape product.
        //   Using aw×ah stretches it. Use Math.min(aw, ah) centered to avoid distortion.
        //
        // SUBLIMATION tile composite (pet collar): buildTiledImageUrl already created the canvas
        //   at the correct landscape aspect ratio, so aw×ah fills it perfectly — no stretching.
        //   Client sets fillPrintArea=true when it sends a tile composite.
        const isCutSew        = effectiveTechnique === 'CUT-SEW';
        const isSublimationOp = effectiveTechnique === 'SUBLIMATION';
        const isAllOverPrint  = isCutSew || isSublimationOp;

        if (isAllOverPrint) {
          const scale = typeof designScale === 'number' && designScale > 0 ? designScale : 1.0;
          let w, h;
          if (fillPrintArea && isSublimationOp) {
            // Tile composite already matches the print area shape — fill both axes
            w = Math.round(aw * scale);
            h = Math.round(ah * scale);
          } else {
            // Single image (or CUT-SEW): square placement on shorter axis avoids stretching
            const shorter = Math.min(aw, ah);
            w = Math.round(shorter * scale);
            h = Math.round(shorter * scale);
          }
          resolvedPosition = {
            area_width: aw,
            area_height: ah,
            width: w,
            height: h,
            top:  Math.round((ah - h) / 2),
            left: Math.round((aw - w) / 2),
          };
          console.log(`📐 All-over print position (${effectiveTechnique}, scale=${scale}, fillPrintArea=${!!fillPrintArea}, ${aw}×${ah}): w=${w}, h=${h}`);
        } else if (designPlacement === 'leftchest' && productConfig.id !== 'hat') {
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
          // Centered full-front (or hat embroidery), with optional drag offset.
          // Use imageAspect (naturalWidth / naturalHeight, already accounting for rotation)
          // to compute proportional width × height.
          //
          // Scale = 1.0 (100%) means "fit to print area" — the image fills as much of
          // aw × ah as possible while preserving aspect ratio. Smaller scale values
          // shrink proportionally from that maximum.
          const scale = typeof designScale === 'number' && designScale > 0
            ? designScale
            : (productConfig.defaultScale ?? (effectiveTechnique === 'EMBROIDERY' ? 0.45 : 0.85));
          const aspect = typeof imageAspect === 'number' && imageAspect > 0 ? imageAspect : 1;
          // Maximum size that fits within aw × ah preserving aspect ratio
          let maxFitW, maxFitH;
          if (aspect >= aw / ah) {
            // Image is wider than the print area's own aspect → constrain by width
            maxFitW = aw;
            maxFitH = aw / aspect;
          } else {
            // Image is taller → constrain by height
            maxFitH = ah;
            maxFitW = ah * aspect;
          }
          let dw = Math.round(maxFitW * scale);
          let dh = Math.round(maxFitH * scale);
          // designOffsetX/Y are normalized fractions of the print area (from client drag).
          // Clamp so design always stays fully inside the print area.
          const maxOffX = Math.max(0, (aw - dw) / 2);
          const maxOffY = Math.max(0, (ah - dh) / 2);
          const offX = typeof designOffsetX === 'number'
            ? Math.max(-maxOffX, Math.min(maxOffX, Math.round(designOffsetX * aw)))
            : 0;
          const offY = typeof designOffsetY === 'number'
            ? Math.max(-maxOffY, Math.min(maxOffY, Math.round(designOffsetY * ah)))
            : 0;
          resolvedPosition = {
            area_width: aw,
            area_height: ah,
            width: dw,
            height: dh,
            top:  Math.round((ah - dh) / 2) + offY,
            left: Math.round((aw - dw) / 2) + offX,
          };
          console.log(`📐 Centered position (scale=${scale}, aspect=${aspect.toFixed(3)}, ${aw}×${ah}): dw=${dw}, dh=${dh}, offX=${offX}, offY=${offY}`);
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

    console.log(`🎨 Mockup task created — FID: ${auth.fid}, product: ${productConfig.label}, technique: ${effectiveTechnique || 'DTG'}, placement: ${designPlacement || 'center'}, task: ${result.task_key}`);

    return NextResponse.json({
      success: true,
      taskKey: result.task_key,
      status: result.status,
      positionData: resolvedPosition,
      variantIds,
    });
  } catch (error) {
    console.error('Create mockup task error:', error);
    return NextResponse.json({ error: error.message || 'Failed to start mockup generation' }, { status: 500 });
  }
}
