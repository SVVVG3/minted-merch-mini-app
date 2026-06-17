/**
 * Printful product-template creation utility.
 *
 * SECURITY:
 *  • Only imported by server-side routes.
 *  • Uses PRINTFUL_API_KEY (server env only — never NEXT_PUBLIC_*).
 *  • Uses SUPABASE_SERVICE_ROLE_KEY (server env only).
 */

import { createClient } from '@supabase/supabase-js';
import { getProductVariants, getPrintfiles } from '@/lib/printfulMockup';
import { getProductConfig } from '@/lib/designStudioConfig';

const PRINTFUL_BASE = 'https://api.printful.com';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Creates a Printful product template for a custom-merch design request and
 * updates the matching Supabase row with the resulting template ID.
 *
 * @param {string} designRequestId  - UUID from design_order_requests
 * @param {string|null} shopifyOrderId      - Shopify order GID (optional)
 * @param {string|null} shopifyOrderNumber  - Shopify order name e.g. "#1001" (optional)
 * @returns {Promise<{ success: boolean, templateId?: string|null, error?: string }>}
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
  // even if Printful template creation fails below.
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

  // ── Fallback: recompute variant IDs and/or position data if missing ──────
  // This handles past mockup orders where these fields weren't stored at
  // generation time.
  let variantIds = Array.isArray(req.printful_variant_ids) ? req.printful_variant_ids : [];
  let positionData = req.position_data || null;

  if (variantIds.length === 0 && req.color_name) {
    try {
      const productConfig = getProductConfig(req.product_type);
      if (productConfig) {
        const variants = await getProductVariants(productConfig.printfulProductId);
        const allVariants = variants?.result || variants || [];
        const colorLower = req.color_name.toLowerCase();
        const matched = allVariants.filter(v =>
          v.color && v.color.toLowerCase() === colorLower
        );
        if (matched.length > 0) {
          variantIds = matched.slice(0, 3).map(v => v.id);
          console.log(`🎨 Fallback: resolved ${variantIds.length} variant IDs for color "${req.color_name}"`);
        } else {
          // No exact match — use first 3 variants as a safe fallback
          variantIds = allVariants.slice(0, 3).map(v => v.id);
          console.warn(`⚠️ Fallback: no exact color match for "${req.color_name}", using first ${variantIds.length} variants`);
        }
      }
    } catch (varErr) {
      console.error('⚠️ Fallback variant lookup failed:', varErr.message);
    }
  }

  if (!positionData) {
    try {
      const productConfig = getProductConfig(req.product_type);
      if (productConfig) {
        const effectiveTechnique = req.technique === 'DTG' ? null : (req.technique || null);
        const printfilesData = await getPrintfiles(productConfig.printfulProductId, effectiveTechnique);
        const printfiles = printfilesData?.printfiles || [];
        if (printfiles.length > 0) {
          const pf = printfiles[0];
          const aw = pf.width;
          const ah = pf.height;
          const scale = typeof req.design_scale === 'number' && req.design_scale > 0
            ? req.design_scale
            : (productConfig.defaultScale ?? (req.technique === 'EMBROIDERY' ? 0.45 : 0.85));
          const size = Math.round(Math.min(aw, ah) * scale);
          positionData = {
            area_width: aw,
            area_height: ah,
            width: size,
            height: size,
            top: Math.round((ah - size) / 2),
            left: Math.round((aw - size) / 2),
          };
          console.log(`📐 Fallback: computed position for ${req.product_type} (scale=${scale})`);
        }
      }
    } catch (posErr) {
      console.error('⚠️ Fallback position computation failed:', posErr.message);
    }
  }

  // Build a human-readable template name
  const productType = req.product_type
    ? req.product_type.charAt(0).toUpperCase() + req.product_type.slice(1)
    : 'Custom';

  const templateName = [
    `Custom ${productType}`,
    req.size ? `(${req.size})` : null,
    req.color_name ? `— ${req.color_name}` : null,
    shopifyOrderNumber ? `| Order ${shopifyOrderNumber}` : null,
    `| FID ${req.fid}`,
  ]
    .filter(Boolean)
    .join(' ');

  // Build the files array — use resolved positionData (from DB or fallback)
  const files = [];
  if (req.design_url && positionData) {
    // Map our internal placement/product strings to Printful file type strings.
    // Printful accepts: 'front', 'back', 'label_outside', 'embroidery_front', etc.
    // Our placements: 'center' (full front), 'leftchest' (left chest)
    // For hats the only printable area is 'front'.
    let fileType = 'front'; // safe default
    if (req.product_type === 'hat') {
      fileType = 'front';
    } else if (req.placement === 'leftchest' && req.technique === 'EMBROIDERY') {
      fileType = 'embroidery_chest_left';
    } else if (req.placement === 'leftchest') {
      fileType = 'front'; // DTG left chest still uses 'front' printfile
    } else {
      fileType = 'front'; // center / full front
    }

    files.push({
      type: fileType,
      url: req.design_url,
      position: positionData,
    });
  }

  const templatePayload = {
    name: templateName,
    variant_ids: variantIds,
    files,
    ...(req.technique === 'EMBROIDERY' && {
      options: [{ id: 'technique', value: 'EMBROIDERY' }],
    }),
  };

  console.log(
    `🖨️ Creating Printful template: "${templateName}" (designRequestId: ${designRequestId})`
  );

  try {
    const printfulRes = await fetch(`${PRINTFUL_BASE}/product-templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templatePayload),
    });

    const printfulBody = await printfulRes.json();

    if (!printfulRes.ok) {
      const errMsg =
        printfulBody?.error?.message ||
        printfulBody?.result ||
        printfulRes.statusText;
      console.error(
        `❌ Printful template creation failed (${printfulRes.status}): ${errMsg}`
      );
      return { success: false, error: `Printful error: ${errMsg}` };
    }

    const templateId =
      printfulBody?.result?.id ?? printfulBody?.id ?? null;

    console.log(
      `✅ Printful template created — id: ${templateId}, name: "${templateName}"`
    );

    // Persist the template ID and order reference back to Supabase
    await supabase
      .from('design_order_requests')
      .update({
        printful_template_id: templateId != null ? String(templateId) : null,
        shopify_order_id: shopifyOrderId || null,
        shopify_order_number: shopifyOrderNumber || null,
      })
      .eq('id', designRequestId);

    return { success: true, templateId };
  } catch (err) {
    console.error(`❌ createPrintfulTemplate error for ${designRequestId}:`, err);
    return { success: false, error: err.message };
  }
}
