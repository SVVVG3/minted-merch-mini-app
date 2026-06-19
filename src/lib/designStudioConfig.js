/**
 * Design Studio product configuration.
 * Add new products here — the rest of the system is config-driven.
 *
 * Printful product IDs (from Printful catalog):
 *   AS Colour 5001T tee         → 733
 *   Cotton Heritage M2580       → 380
 *   Yupoong 6245CM dad hat      → 206
 *   All-Over Print Bandana      → 630
 *   Pet Bandana Collar          → 902
 *
 * Shopify Product IDs (confirmed from Supabase products table):
 *   Design Studio Custom T-Shirt         → 10666474078489  (gid://shopify/Product/10666474078489)
 *   Design Studio Custom Hoodie          → 10666480009497
 *   Design Studio Custom Hat             → 10666471031065
 *   Design Studio Custom Bandana         → 10672148087065
 *   Design Studio Custom Pet Bandana Collar → 10672149954841
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
    sizeNote: null,
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
    sizeNote: null,
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
    sizeNote: null,
  },
  {
    id: 'bandana',
    label: 'Bandana',
    emoji: '🪡',
    printfulProductId: 630,          // All-Over Print Bandana
    shopifyProductId: 'gid://shopify/Product/10672148087065',
    displayPrice: 24.99,
    sizes: ['S', 'M', 'L'],
    placement: 'front',
    technique: 'SUBLIMATION',        // internal identifier (used for isSublimation check)
    printfulTechnique: 'CUT-SEW',    // Printful API only accepts CUT-SEW for this product
    techniqueLabel: 'All-Over Print',
    defaultScale: 1.0,               // All-over print — design fills the full area
    note: null,
    sizeNote: 'Important sizing info: the S size is made for small pets and won\'t fit a grown-up. Please choose M or L if ordering for yourself. Sizes — S: 17⅜″ × 17⅜″ · M: 21¼″ × 21¼″ · L: 25¼″ × 25¼″',
  },
  {
    id: 'pet-collar',
    label: 'Pet Bandana Collar',
    emoji: '🐾',
    printfulProductId: 902,          // Pet Bandana Collar
    shopifyProductId: 'gid://shopify/Product/10672149954841',
    displayPrice: 24.99,
    sizes: ['S', 'M', 'L', 'XL'],
    placement: 'front',
    technique: 'SUBLIMATION',        // internal identifier
    printfulTechnique: 'SUBLIMATION', // Printful API technique for this product
    techniqueLabel: 'Sublimation',
    defaultScale: 1.0,               // All-over sublimation
    note: null,
    sizeNote: 'Collar circumference — S: 10″–16.75″ · M: 12″–20.25″ · L: 14.25″–23″ · XL: 15.5″–23.5″',
  },
];

export function getProductConfig(id) {
  return DESIGN_STUDIO_PRODUCTS.find(p => p.id === id) || null;
}
