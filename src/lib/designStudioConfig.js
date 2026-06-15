/**
 * Design Studio product configuration.
 * Add new products here — the rest of the system is config-driven.
 *
 * Printful product IDs (from Printful catalog):
 *   AS Colour 5001T tee      → 733
 *   Cotton Heritage M2580    → 380
 *   Yupoong 6245CM dad hat   → 206
 *
 * Shopify Product IDs (confirmed from Supabase products table):
 *   Design Studio Custom T-Shirt  → 10666474078489  (gid://shopify/Product/10666474078489)
 *   Design Studio Custom Hoodie   → 10666480009497
 *   Design Studio Custom Hat      → 10666471031065
 *
 * Note: variant IDs are fetched dynamically at buy-time via /api/design-studio/shopify-variants
 * so we never need to hardcode them — Shopify returns the right variant per size choice.
 */
export const DESIGN_STUDIO_PRODUCTS = [
  {
    id: 'tshirt',
    label: 'T-Shirt',
    emoji: '👕',
    printfulProductId: 733,          // AS Colour 5001T
    shopifyProductId: 'gid://shopify/Product/10666474078489',
    displayPrice: 29.99,               // Fallback for cart display; overridden by real Shopify price
    sizes: ['S', 'M', 'L', 'XL', '2XL'], // Fallback; real sizes fetched from Shopify at buy-time
    placement: 'front',
    technique: null,                 // DTG (default)
    techniqueLabel: 'DTG Print',
    defaultScale: 0.85,              // % of printable area width
    note: null,
  },
  {
    id: 'hoodie',
    label: 'Hoodie',
    emoji: '🧥',
    printfulProductId: 380,          // Cotton Heritage M2580
    shopifyProductId: 'gid://shopify/Product/10666480009497',
    displayPrice: 59.99,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    placement: 'front',
    technique: null,                 // set dynamically by user choice (DTG | EMBROIDERY)
    techniqueLabel: null,            // shown after user picks technique
    techniqueOptions: ['DTG', 'EMBROIDERY'], // user can choose
    defaultScale: 0.85,              // default for DTG; embroidery overrides to 0.45
    note: null,
  },
  {
    id: 'hat',
    label: 'Hat',
    emoji: '🧢',
    printfulProductId: 206,          // Yupoong 6245CM
    shopifyProductId: 'gid://shopify/Product/10666471031065',
    displayPrice: 24.99,
    sizes: ['One Size'],
    placement: 'front',
    technique: 'EMBROIDERY',
    techniqueLabel: 'Embroidery',
    defaultScale: 0.45,              // Embroidery area is physically small — keep logos modest
    note: null,                      // embroidery tip shown on the preview step instead
  },
];

export function getProductConfig(id) {
  return DESIGN_STUDIO_PRODUCTS.find(p => p.id === id) || null;
}
