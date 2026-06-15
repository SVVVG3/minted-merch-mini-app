/**
 * Printful product-template creation utility.
 *
 * SECURITY:
 *  • Only imported by server-side routes.
 *  • Uses PRINTFUL_API_KEY (server env only — never NEXT_PUBLIC_*).
 *  • Uses SUPABASE_SERVICE_ROLE_KEY (server env only).
 */

import { createClient } from '@supabase/supabase-js';

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

  // Build the files array — position_data holds the exact printfile coordinates
  const files = [];
  if (req.design_url && req.position_data) {
    // Map our internal placement strings to Printful file type strings
    const fileType =
      req.placement === 'leftchest'
        ? 'embroidery_front' // Printful uses this key for left-chest embroidery
        : req.placement || 'front';

    files.push({
      type: fileType,
      url: req.design_url,
      position: req.position_data,
    });
  }

  const templatePayload = {
    name: templateName,
    variant_ids: Array.isArray(req.printful_variant_ids)
      ? req.printful_variant_ids
      : [],
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
