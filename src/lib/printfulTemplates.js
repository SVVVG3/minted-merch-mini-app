/**
 * Printful draft-order creation utility.
 *
 * SECURITY:
 *  • Only imported by server-side routes.
 *  • Uses PRINTFUL_API_KEY (server env only — never NEXT_PUBLIC_*).
 *  • Uses SUPABASE_SERVICE_ROLE_KEY (server env only).
 *
 * After a custom design order is paid we create a DRAFT order in Printful
 * (confirm: false) so the admin can review and confirm production.
 * Printful's /product-templates endpoint does not support POST — templates
 * can only be created via the dashboard UI.
 */

import { createClient } from '@supabase/supabase-js';
import { getProductVariants, getPrintfiles } from '@/lib/printfulMockup';
import { getProductConfig } from '@/lib/designStudioConfig';

const PRINTFUL_BASE = 'https://api.printful.com';

/** Valid US address for listing/template drafts (Printful validates state + ZIP). */
const PRINTFUL_LISTING_DUMMY_RECIPIENT = {
  address1: '262 W Santa Clara St',
  city: 'Ventura',
  state_code: 'CA',
  country_code: 'US',
  zip: '93001',
};

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function resolveEffectivePrintfulTechnique(productConfig, reqTechnique) {
  const raw =
    productConfig?.printfulTechnique ||
    reqTechnique ||
    productConfig?.technique ||
    null;
  if (!raw || raw === 'DTG') return null;
  return raw;
}

function isSizeOnlyProduct(productConfig) {
  return productConfig?.technique === 'SUBLIMATION';
}

function isAllOverPrintTechnique(effectiveTechnique, productConfig) {
  return (
    effectiveTechnique === 'CUT-SEW' ||
    effectiveTechnique === 'SUBLIMATION' ||
    productConfig?.technique === 'SUBLIMATION'
  );
}

function resolveVariantFromList(allVariants, req, productConfig) {
  const sizeNorm = (req.size || '').toUpperCase().trim();
  const colorLower = (req.color_name || '').toLowerCase();

  if (isSizeOnlyProduct(productConfig)) {
    const bySize = allVariants.filter(
      (v) => v.size && v.size.toUpperCase().trim() === sizeNorm
    );
    const matched = bySize.length > 0 ? bySize : allVariants;
    return matched[0]?.id ?? null;
  }

  let matched = allVariants.filter(
    (v) =>
      v.color &&
      v.color.toLowerCase() === colorLower &&
      v.size &&
      v.size.toUpperCase().trim() === sizeNorm
  );

  if (matched.length === 0 && colorLower) {
    console.warn(
      `⚠️ No exact color+size match for "${req.color_name}" / "${req.size}" — falling back to color-only`
    );
    matched = allVariants.filter(
      (v) => v.color && v.color.toLowerCase() === colorLower
    );
  }

  if (matched.length === 0) {
    const bySize = allVariants.filter(
      (v) => v.size && v.size.toUpperCase().trim() === sizeNorm
    );
    if (bySize.length > 0) matched = bySize;
  }

  if (matched.length === 0) {
    console.warn('⚠️ No variant match — using first available variant');
    matched = allVariants;
  }

  return matched[0]?.id ?? null;
}

function resolveStoredVariantId(req, productConfig) {
  const storedIds = Array.isArray(req.printful_variant_ids) ? req.printful_variant_ids : [];
  if (!storedIds.length) return null;

  if (isSizeOnlyProduct(productConfig) && productConfig?.sizes?.length) {
    const sizeIndex = productConfig.sizes.indexOf(req.size);
    if (sizeIndex >= 0 && sizeIndex < storedIds.length) {
      return storedIds[sizeIndex];
    }
  }

  return storedIds[0] ?? null;
}

function computeAllOverPosition(pf, req, productConfig) {
  const aw = pf.width;
  const ah = pf.height;
  const scale =
    typeof req.design_scale === 'number' && req.design_scale > 0
      ? req.design_scale
      : productConfig.defaultScale ?? 1.0;
  const shorter = Math.min(aw, ah);
  const size = Math.round(shorter * scale);
  return {
    area_width: aw,
    area_height: ah,
    width: size,
    height: size,
    top: Math.round((ah - size) / 2),
    left: Math.round((aw - size) / 2),
  };
}

/** Read PNG width/height from the first bytes of an image URL (Printful designs are PNG). */
async function getImageDimensionsFromUrl(imageUrl) {
  if (!imageUrl) return null;

  try {
    const res = await fetch(imageUrl, {
      headers: { Range: 'bytes=0-32' },
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 24) return null;

    const isPng =
      view.getUint8(0) === 0x89 &&
      view.getUint8(1) === 0x50 &&
      view.getUint8(2) === 0x4e &&
      view.getUint8(3) === 0x47;
    if (isPng) {
      return {
        width: view.getUint32(16),
        height: view.getUint32(20),
      };
    }

    // JPEG: SOF0 marker scan (best-effort for non-PNG uploads)
    if (view.getUint8(0) === 0xff && view.getUint8(1) === 0xd8) {
      const full = await fetch(imageUrl).then((r) => r.arrayBuffer());
      const jpeg = new DataView(full);
      let offset = 2;
      while (offset + 9 < jpeg.byteLength) {
        if (jpeg.getUint8(offset) !== 0xff) break;
        const marker = jpeg.getUint8(offset + 1);
        const length = jpeg.getUint16(offset + 2);
        if (marker === 0xc0 || marker === 0xc2) {
          return {
            width: jpeg.getUint16(offset + 7),
            height: jpeg.getUint16(offset + 5),
          };
        }
        offset += 2 + length;
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not read image dimensions:', err.message);
  }

  return null;
}

/**
 * Printful requires position width/height aspect ratio to match the design file (~2% tolerance).
 */
function fixPositionAspectRatio(positionData, imageWidth, imageHeight) {
  if (!positionData?.width || !positionData?.height || !imageWidth || !imageHeight) {
    return positionData;
  }

  const targetAspect = imageWidth / imageHeight;
  const currentAspect = positionData.width / positionData.height;
  const relativeDiff = Math.abs(currentAspect - targetAspect) / targetAspect;
  if (relativeDiff <= 0.02) return positionData;

  const aw = positionData.area_width;
  const ah = positionData.area_height;
  let width = positionData.width;
  let height = Math.round(width / targetAspect);

  if (height > ah) {
    height = positionData.height;
    width = Math.round(height * targetAspect);
  }
  if (width > aw) {
    width = aw;
    height = Math.round(width / targetAspect);
  }

  console.warn(
    `⚠️ Adjusted Printful position aspect ${currentAspect.toFixed(2)} → ${(width / height).toFixed(2)} to match image (${imageWidth}×${imageHeight})`
  );

  return {
    ...positionData,
    width,
    height,
    top: Math.round((ah - height) / 2),
    left: Math.round((aw - width) / 2),
  };
}

async function resolvePositionData(req, productConfig, effectiveTechnique) {
  if (!productConfig) return req.position_data || null;

  try {
    const printfilesData = await getPrintfiles(
      productConfig.printfulProductId,
      effectiveTechnique
    );
    const printfiles = printfilesData?.printfiles || [];
    if (printfiles.length === 0) return req.position_data || null;

    const pf = printfiles[0];

    if (isAllOverPrintTechnique(effectiveTechnique, productConfig)) {
      const position = computeAllOverPosition(pf, req, productConfig);
      console.log(
        `📐 Recomputed all-over position for ${req.product_type} (technique=${effectiveTechnique || 'DTG'})`
      );
      return position;
    }

    if (req.position_data) {
      const dims = await getImageDimensionsFromUrl(req.design_url);
      if (dims) {
        return fixPositionAspectRatio(req.position_data, dims.width, dims.height);
      }
      return req.position_data;
    }

    const aw = pf.width;
    const ah = pf.height;
    const scale =
      typeof req.design_scale === 'number' && req.design_scale > 0
        ? req.design_scale
        : productConfig.defaultScale ??
          (req.technique === 'EMBROIDERY' ? 0.45 : 0.85);
    const size = Math.round(Math.min(aw, ah) * scale);
    const position = {
      area_width: aw,
      area_height: ah,
      width: size,
      height: size,
      top: Math.round((ah - size) / 2),
      left: Math.round((aw - size) / 2),
    };
    console.log(
      `📐 Fallback: computed position for ${req.product_type} (technique=${effectiveTechnique || 'DTG'})`
    );
    return position;
  } catch (posErr) {
    console.error('⚠️ Position resolution failed:', posErr.message);
    return req.position_data || null;
  }
}

/**
 * Printful's /orders API validates the design file aspect ratio against area_width/area_height.
 * Mockup generation uses a wide CUT-SEW canvas (e.g. bandana 375×150) with a square design —
 * omit area_* on orders so placement width/height (matching the image) is used instead.
 */
async function finalizePrintfulOrderPosition(positionData, designUrl, productConfig, effectiveTechnique) {
  if (!positionData) return null;

  const dims = designUrl ? await getImageDimensionsFromUrl(designUrl) : null;
  let pos = dims
    ? fixPositionAspectRatio(positionData, dims.width, dims.height)
    : { ...positionData };

  const imageAspect =
    dims?.width && dims?.height ? dims.width / dims.height : null;

  if (pos.area_width && pos.area_height) {
    const areaAspect = pos.area_width / pos.area_height;
    const areaConflictsWithImage =
      imageAspect != null &&
      Math.abs(areaAspect - imageAspect) / imageAspect > 0.02;
    const isAllOver =
      isAllOverPrintTechnique(effectiveTechnique, productConfig) ||
      productConfig?.id === 'bandana' ||
      productConfig?.id === 'pet-collar';

    if (areaConflictsWithImage || (isAllOver && imageAspect == null)) {
      const { area_width: _aw, area_height: _ah, ...placementOnly } = pos;
      console.warn(
        `📐 Printful order position: omitting area_* (${pos.area_width}×${pos.area_height})` +
          (imageAspect != null ? ` — image aspect ${imageAspect.toFixed(2)}` : '')
      );
      return placementOnly;
    }
  }

  return pos;
}

function resolveStitchColor(colorName) {
  const lower = (colorName || '').toLowerCase();
  if (lower.includes('black')) return 'black';
  if (lower.includes('white')) return 'white';
  return 'clear';
}

function buildPrintfulItemOptions(req, productConfig, effectiveTechnique) {
  const options = [];

  if (req.technique === 'EMBROIDERY' || productConfig?.technique === 'EMBROIDERY') {
    options.push({ id: 'technique', value: 'EMBROIDERY' });
  }

  const needsStitchColor =
    productConfig?.id === 'bandana' || effectiveTechnique === 'CUT-SEW';

  if (needsStitchColor) {
    options.push({
      id: 'stitch_color',
      value: resolveStitchColor(req.color_name),
    });
  }

  return options.length > 0 ? options : null;
}

async function resolvePrintFileType(req, productConfig, effectiveTechnique) {
  if (req.placement === 'leftchest' && req.technique === 'EMBROIDERY') {
    return 'embroidery_chest_left';
  }

  try {
    const printfilesData = await getPrintfiles(
      productConfig.printfulProductId,
      effectiveTechnique
    );
    const placements = Object.keys(printfilesData?.available_placements || {});
    if (placements.length > 0) {
      if (req.placement && placements.includes(req.placement)) return req.placement;
      if (placements.includes('default')) return 'default';
      if (placements.includes('front')) return 'front';
      return placements[0];
    }
  } catch (placementErr) {
    console.error('⚠️ Could not resolve print file type:', placementErr.message);
  }

  return req.placement || productConfig.placement || 'front';
}

/**
 * Creates a draft Printful order for a paid custom design request.
 *
 * @param {string} designRequestId  - UUID from design_order_requests
 * @param {string|null} shopifyOrderId      - Shopify order GID
 * @param {string|null} shopifyOrderNumber  - Shopify order name e.g. "#1001"
 */
export async function createPrintfulTemplate(
  designRequestId,
  shopifyOrderId = null,
  shopifyOrderNumber = null,
  options = {}
) {
  const { forceRetry = false } = options;
  const apiKey = process.env.PRINTFUL_API_KEY;
  if (!apiKey) {
    console.error('❌ PRINTFUL_API_KEY is not configured');
    return { success: false, error: 'Printful not configured' };
  }

  const supabase = getSupabaseAdmin();

  // Fetch the design request record
  const { data: req, error: fetchError } = await supabase
    .from('design_order_requests')
    .select('*')
    .eq('id', designRequestId)
    .single();

  if (fetchError || !req) {
    console.error(`❌ Design request not found: ${designRequestId}`, fetchError);
    return { success: false, error: 'Design request not found' };
  }

  // Limited Drop buyer purchases share one listing Printful draft created at go-live.
  if (req.drop_id && !req.drop_submission_id) {
    if (shopifyOrderId || shopifyOrderNumber) {
      await supabase
        .from('design_order_requests')
        .update({
          shopify_order_id: shopifyOrderId || null,
          shopify_order_number: shopifyOrderNumber || null,
        })
        .eq('id', designRequestId);
    }
    console.log(
      `ℹ️ Skipping Printful draft for limited drop purchase ${designRequestId} — listing draft is created at go-live`
    );
    return { success: true, skipped: true, reason: 'limited_drop_purchase' };
  }

  // Winner listing row — Printful draft is created when the drop goes live.
  if (req.drop_submission_id && !forceRetry) {
    console.log(
      `ℹ️ Skipping Printful draft for drop listing row ${designRequestId} — already handled at go-live`
    );
    return { success: true, skipped: true, reason: 'drop_listing_row' };
  }

  if (req.printful_order_id && !forceRetry) {
    if (shopifyOrderId || shopifyOrderNumber) {
      await supabase
        .from('design_order_requests')
        .update({
          shopify_order_id: shopifyOrderId || null,
          shopify_order_number: shopifyOrderNumber || null,
        })
        .eq('id', designRequestId);
    }
    console.log(
      `ℹ️ Printful draft already exists for ${designRequestId}: ${req.printful_order_id}`
    );
    return {
      success: true,
      printfulOrderId: req.printful_order_id,
      alreadyExists: true,
    };
  }

  // Immediately stamp the Shopify order info so the record is marked as paid
  // even if Printful draft order creation fails below.
  if (shopifyOrderId || shopifyOrderNumber) {
    await supabase
      .from('design_order_requests')
      .update({
        shopify_order_id: shopifyOrderId || null,
        shopify_order_number: shopifyOrderNumber || null,
      })
      .eq('id', designRequestId);
    console.log(`📝 Stamped Shopify order ${shopifyOrderNumber} on design request ${designRequestId}`);
  }

  // ── Resolve the exact Printful variant ID for this color + size ──────────
  // We always call Printful to find the exact match — stored variantIds may be
  // a list of all sizes for the color (not specific to the ordered size).
  let exactVariantId = null;
  const productConfig = getProductConfig(req.product_type);

  try {
    if (productConfig) {
      const variants = await getProductVariants(productConfig.printfulProductId);
      const allVariants = variants?.variants || variants?.result?.variants || [];
      exactVariantId = resolveVariantFromList(allVariants, req, productConfig);
      console.log(
        `🎨 Resolved variant: product="${req.product_type}", color="${req.color_name}", size="${req.size}" → Printful variant ID ${exactVariantId}`
      );
    }
  } catch (varErr) {
    console.error('⚠️ Variant lookup failed:', varErr.message);
  }

  // Last-ditch fallback: use stored variant ID (size-aware for all-over products)
  if (!exactVariantId) {
    exactVariantId = resolveStoredVariantId(req, productConfig);
    if (exactVariantId) {
      console.warn(`⚠️ Falling back to stored variant ID: ${exactVariantId}`);
    }
  }

  if (!exactVariantId) {
    console.error('❌ No variant ID available — cannot create Printful draft order');
    await supabase
      .from('design_order_requests')
      .update({ printful_order_status: 'failed' })
      .eq('id', designRequestId);
    return { success: false, error: 'No variant ID available' };
  }

  // ── Resolve position data (recompute all-over; validate aspect for others) ─
  const effectiveTechnique = resolveEffectivePrintfulTechnique(productConfig, req.technique);
  let positionData = await resolvePositionData(req, productConfig, effectiveTechnique);
  positionData = await finalizePrintfulOrderPosition(
    positionData,
    req.design_url,
    productConfig,
    effectiveTechnique
  );

  // ── Build Printful file type ───────────────────────────────────────────────
  let fileType = 'front';
  if (productConfig) {
    fileType = await resolvePrintFileType(req, productConfig, effectiveTechnique);
  } else if (req.placement === 'leftchest' && req.technique === 'EMBROIDERY') {
    fileType = 'embroidery_chest_left';
  }

  // ── Fetch shipping address from Supabase orders table ────────────────────
  let recipient = null;

  // Limited Drop winner listing draft (no customer order yet)
  if (req.drop_submission_id) {
    let weekLabel = 'Limited Drop';
    try {
      const { data: dropRow } = await supabase
        .from('weekly_drops')
        .select('week_label')
        .eq('id', req.drop_id)
        .maybeSingle();
      if (dropRow?.week_label) weekLabel = dropRow.week_label;
    } catch { /* use default label */ }

    recipient = {
      ...PRINTFUL_LISTING_DUMMY_RECIPIENT,
      name: `Limited Drop Listing — ${weekLabel}`,
    };
  } else if (shopifyOrderNumber) {
    try {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('shipping_address, customer_name, customer_email')
        .eq('order_id', shopifyOrderNumber)
        .single();

      if (orderRow?.shipping_address) {
        const addr = orderRow.shipping_address;
        const [firstName, ...restName] = (orderRow.customer_name || '').split(' ');
        recipient = {
          name: orderRow.customer_name || `${addr.firstName || ''} ${addr.lastName || ''}`.trim(),
          email: orderRow.customer_email || addr.email || null,
          address1: addr.address1 || '',
          address2: addr.address2 || '',
          city: addr.city || '',
          state_code: addr.province || '',
          country_code: addr.country || 'US',
          zip: addr.zip || '',
          phone: addr.phone || '',
        };
      }
    } catch (addrErr) {
      console.error('⚠️ Could not fetch shipping address:', addrErr.message);
    }
  }

  if (!recipient) {
    // Use a placeholder so Printful accepts the draft — admin fills in real address
    recipient = {
      ...PRINTFUL_LISTING_DUMMY_RECIPIENT,
      name: `Custom Order — FID ${req.fid}`,
    };
    console.warn('⚠️ No shipping address found — using placeholder recipient in Printful draft');
  }

  // ── Build the Printful order payload ─────────────────────────────────────
  let orderName = [
    `Custom ${req.product_type || 'Item'}`,
    shopifyOrderNumber ? `| Shopify ${shopifyOrderNumber}` : null,
    `| FID ${req.fid}`,
  ].filter(Boolean).join(' ');

  if (req.drop_submission_id) {
    let weekLabel = 'Limited Drop';
    try {
      const { data: dropRow } = await supabase
        .from('weekly_drops')
        .select('week_label')
        .eq('id', req.drop_id)
        .maybeSingle();
      if (dropRow?.week_label) weekLabel = dropRow.week_label;
    } catch { /* ignore */ }
    orderName = `Limited Drop ${weekLabel} | ${req.product_type || 'Item'} | FID ${req.fid}`;
  }

  const files = req.design_url
    ? [{
        type: fileType,
        url: req.design_url,
        ...(positionData ? { position: positionData } : {}),
      }]
    : [];

  const itemOptions = buildPrintfulItemOptions(req, productConfig, effectiveTechnique);

  const orderPayload = {
    confirm: false, // draft — admin confirms in Printful dashboard
    recipient,
    items: [
      {
        variant_id: exactVariantId,
        quantity: 1,
        ...(itemOptions && { options: itemOptions }),
        files,
      },
    ],
    // Metadata visible in Printful dashboard (Printful rejects hyphens in external_id)
    external_id: designRequestId.replace(/-/g, ''),
    ...(shopifyOrderNumber && { retail_costs: { currency: 'USD' } }),
  };

  console.log(`🖨️ Creating Printful draft order: "${orderName}" (designRequestId: ${designRequestId})`);
  console.log(`📐 Position data being sent: ${positionData ? JSON.stringify(positionData) : 'NONE (no position — Printful will default to center)'}`);
  console.log(`🎨 File type: ${fileType}, Design URL: ${req.design_url || 'MISSING'}`);
  if (itemOptions) {
    console.log(`🧵 Printful item options: ${JSON.stringify(itemOptions)}`);
  }

  try {
    const printfulRes = await fetch(`${PRINTFUL_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const printfulBody = await printfulRes.json();

    if (!printfulRes.ok) {
      const errMsg =
        printfulBody?.error?.message ||
        printfulBody?.result ||
        printfulRes.statusText;
      console.error(`❌ Printful draft order failed (${printfulRes.status}): ${errMsg}`);
      console.error('Printful response body:', JSON.stringify(printfulBody));
      await supabase
        .from('design_order_requests')
        .update({ printful_order_status: 'failed' })
        .eq('id', designRequestId);
      return { success: false, error: `Printful error: ${errMsg}` };
    }

    const printfulOrderId =
      printfulBody?.result?.id ?? printfulBody?.id ?? null;
    const printfulOrderStatus =
      printfulBody?.result?.status ?? printfulBody?.status ?? 'draft';

    console.log(`✅ Printful draft order created — id: ${printfulOrderId}, status: ${printfulOrderStatus}`);

    // Persist the Printful order ID back to Supabase
    await supabase
      .from('design_order_requests')
      .update({
        printful_order_id: printfulOrderId != null ? String(printfulOrderId) : null,
        printful_order_status: printfulOrderStatus,
        // Keep printful_template_id field populated for backward-compat display
        printful_template_id: printfulOrderId != null ? String(printfulOrderId) : null,
      })
      .eq('id', designRequestId);

    return { success: true, printfulOrderId };
  } catch (err) {
    console.error(`❌ createPrintfulTemplate error for ${designRequestId}:`, err);
    return { success: false, error: err.message };
  }
}
