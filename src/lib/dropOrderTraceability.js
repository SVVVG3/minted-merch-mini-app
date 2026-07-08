import { supabaseAdmin } from '@/lib/supabase';

/**
 * Fetch week labels for drop IDs referenced in cart items.
 * @returns {Map<string, string>}
 */
export async function fetchDropWeekLabels(cartItems) {
  const dropIds = [
    ...new Set(
      (cartItems || [])
        .map((item) => item?.customMeta?.dropId)
        .filter(Boolean)
    ),
  ];

  const map = new Map();
  if (dropIds.length === 0) return map;

  const { data: drops, error } = await supabaseAdmin
    .from('weekly_drops')
    .select('id, week_label')
    .in('id', dropIds);

  if (error) throw error;
  for (const drop of drops || []) {
    map.set(drop.id, drop.week_label || 'Unknown week');
  }
  return map;
}

/**
 * Build Shopify order notes + tags from cart customMeta.
 */
export function buildOrderSourceMetadata(cartItems, dropWeekLabels, baseNotes = '') {
  const dropItems = (cartItems || []).filter((item) => item?.customMeta?.dropId);
  const ownDesignItems = (cartItems || []).filter(
    (item) => item?.customMeta?.designRequestId && !item?.customMeta?.dropId
  );

  const lines = [];
  const tags = ['farcaster-mini-app', 'usdc-payment'];

  const seenDropIds = new Set();
  for (const item of dropItems) {
    const dropId = item.customMeta.dropId;
    if (seenDropIds.has(dropId)) continue;
    seenDropIds.add(dropId);
    const weekLabel = dropWeekLabels.get(dropId) || 'Unknown week';
    lines.push(`Limited Drop: ${weekLabel} (Drop ID: ${dropId})`);
    tags.push('limited-drop');
  }

  if (ownDesignItems.length > 0) {
    lines.push('Order source: Design Studio (own design)');
    tags.push('design-studio-custom');
  }

  let notes = baseNotes || '';
  if (lines.length > 0) {
    const block = `--- ORDER SOURCE ---\n${lines.join('\n')}`;
    notes = notes ? `${notes}\n\n${block}` : block;
  }

  return { notes, tags: [...new Set(tags)] };
}

/**
 * Clone the winner listing row into a per-buyer design_order_requests record.
 * Listing rows keep drop_submission_id; buyer rows only set drop_id.
 */
export async function createBuyerDropDesignRequest({
  buyerFid,
  listingDesignRequestId,
  dropId,
  size,
  colorName,
  shopifyOrderId,
  shopifyOrderNumber,
}) {
  const { data: listing, error } = await supabaseAdmin
    .from('design_order_requests')
    .select('*')
    .eq('id', listingDesignRequestId)
    .single();

  if (error || !listing) {
    throw new Error(`Listing design request not found: ${listingDesignRequestId}`);
  }

  const { data: buyerRow, error: insertErr } = await supabaseAdmin
    .from('design_order_requests')
    .insert({
      fid: buyerFid,
      product_type: listing.product_type,
      size: size || listing.size,
      color_name: colorName || listing.color_name,
      technique: listing.technique,
      design_url: listing.design_url,
      mockup_url: listing.mockup_url,
      placement: listing.placement,
      design_scale: listing.design_scale,
      printful_product_id: listing.printful_product_id,
      printful_variant_ids: listing.printful_variant_ids,
      position_data: listing.position_data,
      drop_id: dropId,
      shopify_order_id: shopifyOrderId || null,
      shopify_order_number: shopifyOrderNumber || null,
    })
    .select('id')
    .single();

  if (insertErr) {
    throw new Error(insertErr.message);
  }

  console.log(
    `📝 Created buyer drop design request ${buyerRow.id} (drop ${dropId}, buyer FID ${buyerFid}, listing ${listingDesignRequestId})`
  );

  return buyerRow.id;
}

/**
 * Map cart custom design lines to design_request IDs for Printful.
 * Limited-drop purchases get a fresh per-buyer row instead of the shared listing row.
 */
export async function resolveDesignRequestIdsForOrder({
  customDesignItems,
  buyerFid,
  shopifyOrderId,
  shopifyOrderNumber,
}) {
  const resolved = [];

  for (const item of customDesignItems) {
    const meta = item.customMeta || {};
    if (meta.dropId && buyerFid) {
      const size =
        meta.size ||
        (item.variant?.title && item.variant.title !== 'Default Title'
          ? item.variant.title
          : null);

      const buyerRequestId = await createBuyerDropDesignRequest({
        buyerFid,
        listingDesignRequestId: meta.designRequestId,
        dropId: meta.dropId,
        size,
        colorName: meta.colorName,
        shopifyOrderId,
        shopifyOrderNumber,
      });
      resolved.push(buyerRequestId);
    } else {
      resolved.push(meta.designRequestId);
    }
  }

  return resolved;
}
