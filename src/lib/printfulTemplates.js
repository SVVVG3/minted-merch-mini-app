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
  shopifyOrderNumber = null
) {
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
    return { success: false, error: 'No variant ID available' };
  }

  // ── Resolve position data (fallback: recompute from printfiles) ───────────
  let positionData = req.position_data || null;
  const effectiveTechnique = resolveEffectivePrintfulTechnique(productConfig, req.technique);

  if (!positionData && productConfig) {
    try {
      const printfilesData = await getPrintfiles(
        productConfig.printfulProductId,
        effectiveTechnique
      );
      const printfiles = printfilesData?.printfiles || [];
      if (printfiles.length > 0) {
        const pf = printfiles[0];
        if (isAllOverPrintTechnique(effectiveTechnique, productConfig)) {
          positionData = computeAllOverPosition(pf, req, productConfig);
        } else {
          const aw = pf.width;
          const ah = pf.height;
          const scale =
            typeof req.design_scale === 'number' && req.design_scale > 0
              ? req.design_scale
              : productConfig.defaultScale ??
                (req.technique === 'EMBROIDERY' ? 0.45 : 0.85);
          const size = Math.round(Math.min(aw, ah) * scale);
          positionData = {
            area_width: aw,
            area_height: ah,
            width: size,
            height: size,
            top: Math.round((ah - size) / 2),
            left: Math.round((aw - size) / 2),
          };
        }
        console.log(
          `📐 Fallback: computed position for ${req.product_type} (technique=${effectiveTechnique || 'DTG'})`
        );
      }
    } catch (posErr) {
      console.error('⚠️ Fallback position computation failed:', posErr.message);
    }
  }

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
  if (req.drop_id) {
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

  if (req.drop_id) {
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

  const needsEmbroideryOption =
    req.technique === 'EMBROIDERY' || productConfig?.technique === 'EMBROIDERY';

  const orderPayload = {
    confirm: false, // draft — admin confirms in Printful dashboard
    recipient,
    items: [
      {
        variant_id: exactVariantId,
        quantity: 1,
        ...(needsEmbroideryOption && {
          options: [{ id: 'technique', value: 'EMBROIDERY' }],
        }),
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
