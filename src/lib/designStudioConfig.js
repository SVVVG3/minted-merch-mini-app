/**
 * Design Studio product configuration.
 * Add new products here — the rest of the system is config-driven.
 *
 * Product IDs confirmed from Printful's JSON-LD catalog data:
 *   AS Colour 5001T tee  → 733
 *   Cotton Heritage M2580 hoodie → 380
 *   Yupoong 6245CM dad hat → 206
 */
export const DESIGN_STUDIO_PRODUCTS = [
  {
    id: 'tshirt',
    label: 'T-Shirt',
    emoji: '👕',
    printfulProductId: 733,   // AS Colour 5001T
    placement: 'front',
    technique: null,           // DTG (default)
    note: null,
  },
  {
    id: 'hoodie',
    label: 'Hoodie',
    emoji: '🧥',
    printfulProductId: 380,   // Cotton Heritage M2580
    placement: 'front',
    technique: null,           // DTG (default)
    note: null,
  },
  {
    id: 'hat',
    label: 'Hat',
    emoji: '🧢',
    printfulProductId: 206,   // Yupoong 6245CM
    placement: 'front',
    technique: 'EMBROIDERY',
    note: 'Hat designs use embroidery. Simple logos with few colors work best.',
  },
];

export function getProductConfig(id) {
  return DESIGN_STUDIO_PRODUCTS.find(p => p.id === id) || null;
}
