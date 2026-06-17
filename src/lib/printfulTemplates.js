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

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
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

  // ── Resolve variant IDs (fallback: call Printful API if not stored) ───────
  let variantIds = Array.isArray(req.printful_variant_ids) ? req.printful_variant_ids : [];

  if (variantIds.length === 0) {
    try {
      const productConfig = getProductConfig(req.product_type);
      if (productConfig && req.color_name) {
        const variants = await getProductVariants(productConfig.printfulProductId);
        const allVariants = (variants?.variants || variants?.result?.variants || []);
        const colorLower = req.color_name.toLowerCase();
        const matched = allVariants.filter(v =>
          v.color && v.color.toLowerCase() === colorLower
        );
        variantIds = (matched.length > 0 ? matched : allVariants).slice(0, 3).map(v => v.id);
        console.log(`🎨 Fallback: resolved ${variantIds.length} variant IDs for color "${req.color_name}"`);
      }
    } catch (varErr) {
      console.error('⚠️ Fallback variant lookup failed:', varErr.message);
    }
  }

  if (variantIds.length === 0) {
    console.error('❌ No variant IDs available — cannot create Printful draft order');
    return { success: false, error: 'No variant IDs available' };
  }

  // ── Resolve position data (fallback: recompute from printfiles) ───────────
  let positionData = req.position_data || null;

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
            area_width: aw, area_height: ah,
            width: size, height: size,
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

  // ── Build Printful file type ───────────────────────────────────────────────
  let fileType = 'front';
  if (req.placement === 'leftchest' && req.technique === 'EMBROIDERY') {
    fileType = 'embroidery_chest_left';
  }

  // ── Fetch shipping address from Supabase orders table ────────────────────
  let recipient = null;
  if (shopifyOrderNumber) {
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
      name: `Custom Order — FID ${req.fid}`,
      address1: 'TBD',
      city: 'TBD',
      state_code: 'CA',
      country_code: 'US',
      zip: '00000',
    };
    console.warn('⚠️ No shipping address found — using placeholder recipient in Printful draft');
  }

  // ── Build the Printful order payload ─────────────────────────────────────
  const orderName = [
    `Custom ${req.product_type || 'Item'}`,
    shopifyOrderNumber ? `| Shopify ${shopifyOrderNumber}` : null,
    `| FID ${req.fid}`,
  ].filter(Boolean).join(' ');

  const files = req.design_url
    ? [{
        type: fileType,
        url: req.design_url,
        ...(positionData ? { position: positionData } : {}),
      }]
    : [];

  const orderPayload = {
    confirm: false, // draft — admin confirms in Printful dashboard
    recipient,
    items: [
      {
        variant_id: variantIds[0], // Printful order items use a single variant ID
        quantity: 1,
        ...(req.technique === 'EMBROIDERY' && { options: [{ id: 'technique', value: 'EMBROIDERY' }] }),
        files,
      },
    ],
    // Metadata visible in Printful dashboard (Printful rejects hyphens in external_id)
    external_id: designRequestId.replace(/-/g, ''),
    ...(shopifyOrderNumber && { retail_costs: { currency: 'USD' } }),
  };

  console.log(`🖨️ Creating Printful draft order: "${orderName}" (designRequestId: ${designRequestId})`);

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
