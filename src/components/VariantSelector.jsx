export function VariantSelector({ variants, selectedVariant, onVariantChange }) {
  if (!variants || variants.length <= 1) return null;

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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3eb489] focus:border-transparent bg-white"
      >
        {variants.map(({ node: variant }) => (
          <option
            key={variant.id}
            value={variant.id}
            disabled={!variant.availableForSale}
          >
            {variant.title} - ${parseFloat(variant.price?.amount || 0).toFixed(2)}
            {!variant.availableForSale ? ' (Out of Stock)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}