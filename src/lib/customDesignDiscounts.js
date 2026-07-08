import { getProductConfig } from './designStudioConfig';

/** In-memory cache: shopifyGraphqlId → supabase product id */
const supabaseIdCache = new Map();

export function extractNumericShopifyId(shopifyId) {
  if (!shopifyId) return null;
  const str = String(shopifyId);
  if (str.includes('gid://')) {
    return str.split('/').pop();
  }
  return str;
}

export function getDesignStudioShopifyGraphqlId(productType) {
  if (!productType) return null;
  return getProductConfig(productType)?.shopifyProductId || null;
}

export function getCustomItemShopifyGraphqlId(item) {
  if (item?.customMeta?.productType) {
    return getDesignStudioShopifyGraphqlId(item.customMeta.productType);
  }
  return item?.product?.id || null;
}

export function isProductScopedDiscount(discount) {
  if (!discount) return false;
  return (
    discount.discount_scope === 'product' ||
    (Array.isArray(discount.target_product_ids) && discount.target_product_ids.length > 0) ||
    (Array.isArray(discount.target_products) && discount.target_products.length > 0)
  );
}

/**
 * Resolve Supabase products.id for a Design Studio / Limited Drop cart line.
 * Uses productType from customMeta when available, otherwise the cart product id.
 */
export async function resolveSupabaseIdForCustomItem(item) {
  const shopifyGraphqlId = getCustomItemShopifyGraphqlId(item);
  if (!shopifyGraphqlId) return null;

  if (supabaseIdCache.has(shopifyGraphqlId)) {
    return supabaseIdCache.get(shopifyGraphqlId);
  }

  try {
    const params = new URLSearchParams({
      action: 'get',
      shopifyGraphqlId,
    });
    const res = await fetch(`/api/products?${params.toString()}`);
    if (!res.ok) return null;

    const data = await res.json();
    const supabaseId = data?.product?.id ?? null;
    if (supabaseId != null) {
      supabaseIdCache.set(shopifyGraphqlId, supabaseId);
    }
    return supabaseId;
  } catch (err) {
    console.error('Failed to resolve Supabase product id for custom item:', err);
    return null;
  }
}

export async function resolveSupabaseIdsForCustomItems(items) {
  const customItems = (items || []).filter(item => item.customMeta);
  const entries = await Promise.all(
    customItems.map(async (item) => [item.key, await resolveSupabaseIdForCustomItem(item)])
  );
  return new Map(entries.filter(([, id]) => id != null));
}

/**
 * Whether a cart line qualifies for a product-scoped discount.
 * Supports target_product_ids (Supabase) and legacy target_products (handles).
 */
export function cartItemQualifiesForDiscount(item, discount, supabaseIdByItemKey = null) {
  if (!item || !discount) return false;

  const targetIds = Array.isArray(discount.target_product_ids) ? discount.target_product_ids : [];
  const targetHandles = Array.isArray(discount.target_products) ? discount.target_products : [];

  if (targetIds.length === 0 && targetHandles.length === 0) {
    return discount.discount_scope !== 'product';
  }

  const supabaseId =
    item.product?.supabaseId ||
    supabaseIdByItemKey?.get?.(item.key) ||
    null;

  if (supabaseId != null && targetIds.length > 0 && targetIds.includes(supabaseId)) {
    return true;
  }

  const productHandle = item.product?.handle || '';
  const productTitle = item.product?.title || '';

  if (targetHandles.length > 0) {
    return targetHandles.some((target) => {
      if (typeof target === 'string') {
        return (
          target === productHandle ||
          target === productTitle ||
          productHandle.includes(target) ||
          target.includes(productHandle)
        );
      }
      if (typeof target === 'object' && target?.handle) {
        return target.handle === productHandle;
      }
      return false;
    });
  }

  return false;
}

export function formatDiscountForCart(bestDiscount, sourceProduct = 'custom-design') {
  return {
    code: bestDiscount.code,
    discountType: bestDiscount.discount_type || bestDiscount.type || 'percentage',
    discountValue: bestDiscount.discount_value || bestDiscount.value,
    discountAmount: 0,
    displayText: bestDiscount.displayText || `${bestDiscount.discount_value || bestDiscount.value}% off`,
    description: bestDiscount.description || bestDiscount.discount_description,
    freeShipping: bestDiscount.free_shipping || false,
    discount_scope: bestDiscount.discount_scope || bestDiscount.scope,
    target_products: bestDiscount.target_products || [],
    target_product_ids: bestDiscount.target_product_ids || [],
    isTokenGated: bestDiscount.isTokenGated || false,
    gating_type: bestDiscount.gating_type,
    priority_level: bestDiscount.priority_level || 0,
    sourceProduct,
  };
}
