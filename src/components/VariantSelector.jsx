export function VariantSelector({ variants, selectedVariant, onVariantChange, productDiscount }) {
  if (!variants || variants.length <= 1) return null;

  // Helper function to calculate discounted price
  const calculateDiscountedPrice = (originalPrice) => {
    if (!productDiscount || !productDiscount.discountValue) return originalPrice;
    
    let discountedPrice = originalPrice;
    
    if (productDiscount.discountType === 'percentage') {
      const savings = originalPrice * (productDiscount.discountValue / 100);
      discountedPrice = originalPrice - savings;
    } else if (productDiscount.discountType === 'fixed') {
      const savings = Math.min(productDiscount.discountValue, originalPrice);
      discountedPrice = originalPrice - savings;
    }
    
    return Math.max(discountedPrice, 0); // Ensure non-negative
  };

  return (
    <div>
      <label htmlFor="variant-select" className="block text-sm font-medium text-gray-700 mb-2">
        Options
      </label>
      <select
        id="variant-select"
        value={selectedVariant?.id || ''}
        onChange={(e) => {
          const selectedId = e.target.value;
          const variant = variants.find(({ node }) => node.id === selectedId)?.node;
          if (variant) onVariantChange(variant);
        }}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#3eb489] focus:border-transparent bg-white min-h-[48px]"
      >
        {variants.map(({ node: variant }) => {
          const originalPrice = parseFloat(variant.price?.amount || 0);
          const discountedPrice = calculateDiscountedPrice(originalPrice);
          const hasDiscount = productDiscount && discountedPrice < originalPrice;
          
          return (
            <option
              key={variant.id}
              value={variant.id}
              disabled={!variant.availableForSale}
            >
              {variant.title} - {hasDiscount ? (
                discountedPrice === 0 
                  ? 'FREE' 
                  : `$${discountedPrice.toFixed(2)} (was $${originalPrice.toFixed(2)})`
              ) : (
                `$${originalPrice.toFixed(2)}`
              )}
              {!variant.availableForSale ? ' (Out of Stock)' : ''}
            </option>
          );
        })}
      </select>
    </div>
  );
}