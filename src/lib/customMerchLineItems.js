/** Line items for Design Studio custom merch or Limited Drop purchases. */

export function isCustomMerchLineItem(item) {
  const title = (item?.title || '').toLowerCase();
  return title.includes('design studio custom') || title.includes('limited drop');
}

export function getProductTypeFromLineItemTitle(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('t-shirt') || t.includes('tshirt')) return 'tshirt';
  if (t.includes('hoodie')) return 'hoodie';
  if (t.includes('hat')) return 'hat';
  if (t.includes('bandana')) return 'bandana';
  if (t.includes('pet') || t.includes('collar')) return 'pet-collar';
  return null;
}

export function getLineItemDesignRequestId(item) {
  return item?.designRequestId || item?.customMeta?.designRequestId || null;
}

export function getLineItemCustomImageUrl(item) {
  return item?.customImageUrl || null;
}

export function getLineItemThumbUrl(item, resolvedMockupUrl = null) {
  return (
    getLineItemCustomImageUrl(item) ||
    resolvedMockupUrl ||
    item?.imageUrl ||
    null
  );
}
