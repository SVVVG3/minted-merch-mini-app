import { getCollectionByHandle, getCollections } from '@/lib/shopify';

export async function GET() {
  try {
    // Get all collections first
    const collections = await getCollections();
    console.log('Available collections:', collections.map(c => ({ handle: c.handle, title: c.title })));
    
    // Get the allproducts collection specifically
    const collection = await getCollectionByHandle('allproducts');
    
    if (!collection) {
      return Response.json({ 
        error: 'Collection not found',
        availableCollections: collections.map(c => ({ handle: c.handle, title: c.title }))
      }, { status: 404 });
    }
    
    const products = collection.products.edges.map(edge => edge.node);
    
    return Response.json({
      collection: {
        id: collection.id,
        title: collection.title,
        handle: collection.handle,
        productCount: products.length
      },
      products: products.map(product => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        description: product.description?.substring(0, 100) + '...',
        price: product.priceRange?.minVariantPrice?.amount,
        availableVariants: product.variants?.edges?.length || 0
      })),
      availableCollections: collections.map(c => ({ handle: c.handle, title: c.title }))
    });
    
  } catch (error) {
    console.error('Debug API error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
} 