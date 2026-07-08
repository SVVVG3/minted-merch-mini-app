import { DESIGN_STUDIO_PRODUCTS, getProductConfig } from './designStudioConfig';

/** shopifyGraphqlId → { id, handle } */
const productCache = new Map();

const DESIGN_STUDIO_SHOPIFY_IDS = new Set(
  DESIGN_STUDIO_PRODUCTS.map((p) => p.shopifyProductId).filter(Boolean)
);

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

export function getDesignStudioProductTypeFromItem(item) {
  if (item?.customMeta?.productType) {
    return item.customMeta.productType;
  }
  const handle = item?.product?.handle || '';
  const match = handle.match(/^design-studio-custom-(.+)$/);
  if (match) return match[1];
  const productId = item?.product?.id;
  if (productId && DESIGN_STUDIO_SHOPIFY_IDS.has(productId)) {
    const config = DESIGN_STUDIO_PRODUCTS.find((p) => p.shopifyProductId === productId);
    return config?.id || null;
  }
  return null;
}

export function isDesignStudioCartItem(item) {
  if (!item) return false;
  if (item.customMeta) return true;
  const handle = item.product?.handle || '';
  if (handle.startsWith('design-studio-custom-')) return true;
  return !!(item.product?.id && DESIGN_STUDIO_SHOPIFY_IDS.has(item.product.id));
}

export function getCachedProductForShopifyGraphqlId(shopifyGraphqlId) {
  if (!shopifyGraphqlId) return null;
  return productCache.get(shopifyGraphqlId) ?? null;
}

export function getCachedSupabaseIdForShopifyGraphqlId(shopifyGraphqlId) {
  return getCachedProductForShopifyGraphqlId(shopifyGraphqlId)?.id ?? null;
}

function normalizeProductId(id) {
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function targetIdListIncludes(targetIds, productId) {
  const normalized = normalizeProductId(productId);
  if (normalized == null) return false;
  return targetIds.some((targetId) => normalizeProductId(targetId) === normalized);
}

function targetHandleMatches(target, productHandle, productTitle, catalogHandle) {
  if (typeof target !== 'string') {
    return typeof target === 'object' && target?.handle
      ? target.handle === productHandle || target.handle === catalogHandle
      : false;
  }

  const candidates = [productHandle, productTitle, catalogHandle].filter(Boolean);
  return candidates.some(
    (candidate) =>
      target === candidate ||
      candidate.includes(target) ||
      target.includes(candidate)
  );
}

export function getCustomItemShopifyGraphqlId(item) {
  const productType = getDesignStudioProductTypeFromItem(item);
  if (productType) {
    return getDesignStudioShopifyGraphqlId(productType);
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
 * Resolve Supabase products.id (and catalog handle) for Design Studio / Limited Drop lines.
 */
export async function resolveSupabaseIdForCustomItem(item) {
  const shopifyGraphqlId = getCustomItemShopifyGraphqlId(item);
  if (!shopifyGraphqlId) return null;

  if (productCache.has(shopifyGraphqlId)) {
    return productCache.get(shopifyGraphqlId)?.id ?? null;
  }

  try {
    const params = new URLSearchParams({
      action: 'get',
      shopifyGraphqlId,
    });
    const res = await fetch(`/api/products?${params.toString()}`);
    if (!res.ok) return null;

    const data = await res.json();
    const product = data?.product;
    if (product?.id != null) {
      productCache.set(shopifyGraphqlId, {
        id: product.id,
        handle: product.handle || null,
      });
      return product.id;
    }
    return null;
  } catch (err) {
    console.error('Failed to resolve Supabase product id for custom item:', err);
    return null;
  }
}

export async function resolveSupabaseIdsForCustomItems(items) {
  const designItems = (items || []).filter(isDesignStudioCartItem);
  const entries = await Promise.all(
    designItems.map(async (item) => [item.key, await resolveSupabaseIdForCustomItem(item)])
  );
  return new Map(entries.filter(([, id]) => id != null));
}

/**
 * Whether a cart line qualifies for a product-scoped discount.
 * Supports target_product_ids (Supabase) and legacy target_products (catalog handles).
 */
export function cartItemQualifiesForDiscount(item, discount, supabaseIdByItemKey = null) {
  if (!item || !discount) return false;

  const targetIds = Array.isArray(discount.target_product_ids) ? discount.target_product_ids : [];
  const targetHandles = Array.isArray(discount.target_products) ? discount.target_products : [];

  if (targetIds.length === 0 && targetHandles.length === 0) {
    return discount.discount_scope !== 'product';
  }

  const shopifyGqlId = getCustomItemShopifyGraphqlId(item);
  const cachedProduct = getCachedProductForShopifyGraphqlId(shopifyGqlId);
  const supabaseId =
    item.product?.supabaseId ||
    supabaseIdByItemKey?.get?.(item.key) ||
    cachedProduct?.id ||
    null;

  if (supabaseId != null && targetIds.length > 0 && targetIdListIncludes(targetIds, supabaseId)) {
    return true;
  }

  // Discount was matched to this design studio product at apply time
  if (discount.sourceProduct?.startsWith('custom-design-')) {
    const sourceId = normalizeProductId(discount.sourceProduct.replace('custom-design-', ''));
    if (sourceId != null && isDesignStudioCartItem(item)) {
      if (targetIds.length === 0 || targetIdListIncludes(targetIds, sourceId)) {
        if (supabaseId == null || supabaseId === sourceId) {
          return true;
        }
      }
    }
  }

  const productHandle = item.product?.handle || '';
  const productTitle = item.product?.title || '';
  const catalogHandle =
    cachedProduct?.handle ||
    item.catalogHandle ||
    item.product?.catalogHandle ||
    null;

  if (targetHandles.length > 0) {
    const handleMatch = targetHandles.some((target) =>
      targetHandleMatches(target, productHandle, productTitle, catalogHandle)
    );
    if (handleMatch) return true;

    // Admin targets catalog handle; cart uses synthetic design-studio-custom-* handle
    if (isDesignStudioCartItem(item) && catalogHandle) {
      return targetHandles.some((target) => targetHandleMatches(target, catalogHandle, productTitle, catalogHandle));
    }
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
    sourceProduct: bestDiscount.sourceProduct || sourceProduct,
  };
}
