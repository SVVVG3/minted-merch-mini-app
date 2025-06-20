import Link from 'next/link';

export function ProductCard({ product }) {
  const price = product.priceRange?.minVariantPrice?.amount || '0';
  const imageUrl = product.images?.edges?.[0]?.node?.url || '/placeholder.jpg';
  const imageAlt = product.images?.edges?.[0]?.node?.altText || product.title;

  return (
    <Link 
      href={`/product/${product.handle}`}
      className="block bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square relative">
        <img
          src={imageUrl}
          alt={imageAlt}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
          {product.title}
        </h3>
        <p className="mt-1 text-sm font-semibold text-gray-900">
          ${parseFloat(price)*0.01.toFixed(2)}
        </p>
      </div>
    </Link>
  );
}