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
    techniqueLabel: 'DTG Print',
    defaultScale: 0.85,        // % of printable area width
    note: null,
  },
  {
    id: 'hoodie',
    label: 'Hoodie',
    emoji: '🧥',
    printfulProductId: 380,   // Cotton Heritage M2580
    placement: 'front',
    technique: null,           // DTG (default)
    techniqueLabel: 'DTG Print',
    defaultScale: 0.85,
    note: null,
  },
  {
    id: 'hat',
    label: 'Hat',
    emoji: '🧢',
    printfulProductId: 206,   // Yupoong 6245CM
    placement: 'front',
    technique: 'EMBROIDERY',
    techniqueLabel: 'Embroidery',
    defaultScale: 0.45,        // Embroidery area is physically small — keep logos modest
    note: 'Use a simple logo with NO background and 5 or fewer colors for best results.',
  },
];

export function getProductConfig(id) {
  return DESIGN_STUDIO_PRODUCTS.find(p => p.id === id) || null;
}
