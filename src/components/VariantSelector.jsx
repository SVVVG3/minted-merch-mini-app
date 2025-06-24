export function VariantSelector({ variants, selectedVariant, onVariantChange }) {
  if (!variants || variants.length <= 1) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Options
      </label>
      <div className="flex flex-wrap gap-2">
        {variants.map(({ node: variant }) => (
          <button
            key={variant.id}
            onClick={() => onVariantChange(variant)}
            disabled={!variant.availableForSale}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedVariant?.id === variant.id
                ? 'bg-[#3eb489] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${
              !variant.availableForSale
                ? 'opacity-50 cursor-not-allowed line-through'
                : ''
            }`}
          >
            <span>{variant.title}</span>
            <span className="ml-1">- ${parseFloat(variant.price?.amount || 0).toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}