import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { setSystemContext } from '@/lib/auth';

const SHOPIFY_DOMAIN = process.env.SHOPIFY_SITE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_URL = `https://${SHOPIFY_DOMAIN}.myshopify.com/api/2024-07/graphql.json`;

export async function POST(request) {
  try {
    // 🔧 Set system context to bypass RLS policies for product sync
    await setSystemContext();
    
    if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'Missing Shopify environment variables (SHOPIFY_SITE_DOMAIN, SHOPIFY_ACCESS_TOKEN)'
      }, { status: 500 });
    }

    console.log('🔄 Starting Shopify products sync...');

    const { action = 'sync_all', force = false, handle } = await request.json();

    if (action === 'sync_all') {
      return await syncAllProducts(force);
    } else if (action === 'sync_single') {
      if (!handle) {
        return NextResponse.json({
          success: false,
          error: 'Product handle is required for single sync'
        }, { status: 400 });
      }
      return await syncSingleProduct(handle);
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "sync_all" or "sync_single"'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Error in products sync:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

/**
 * Sync all products from Shopify to Supabase
 */
async function syncAllProducts(force = false) {
  try {
    let allProducts = [];
    let hasNextPage = true;
    let cursor = null;

    // Fetch all products from Shopify using pagination
    while (hasNextPage) {
      const query = `
        query getProducts($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                handle
                title
                description
                productType
                vendor
                tags
                priceRange {
                  minVariantPrice {
                    amount
                  }
                  maxVariantPrice {
                    amount
                  }
                }
                variants(first: 250) {
                  edges {
                    node {
                      id
                    }
                  }
                }
                featuredImage {
                  url
                }
                createdAt
                updatedAt
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const variables = {
        first: 50,
        after: cursor
      };

      const response = await fetch(SHOPIFY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({ query, variables })
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(`Shopify API error: ${JSON.stringify(result.errors)}`);
      }

      const products = result.data?.products?.edges || [];
      allProducts.push(...products);

      hasNextPage = result.data?.products?.pageInfo?.hasNextPage || false;
      cursor = result.data?.products?.pageInfo?.endCursor;

      console.log(`📦 Fetched ${products.length} products (total: ${allProducts.length})`);
    }

    console.log(`✅ Fetched ${allProducts.length} total products from Shopify`);

    // Transform and insert/update products in Supabase
    const productsToUpsert = allProducts.map(({ node }) => ({
      handle: node.handle,
      shopify_id: extractIdFromGid(node.id),
      shopify_graphql_id: node.id,
      title: node.title,
      description: node.description || null,
      product_type: node.productType || null,
      vendor: node.vendor || null,
      status: 'active', // Default to active since status field not available in Storefront API
      tags: node.tags || [],
      price_min: parseFloat(node.priceRange?.minVariantPrice?.amount || 0),
      price_max: parseFloat(node.priceRange?.maxVariantPrice?.amount || 0),
      variant_count: node.variants?.edges?.length || 0,
      image_url: node.featuredImage?.url || null,
      synced_at: new Date().toISOString()
    }));

    // Batch upsert products
    const batchSize = 100;
    let insertedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < productsToUpsert.length; i += batchSize) {
      const batch = productsToUpsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('products')
        .upsert(batch, { 
          onConflict: 'handle',
          ignoreDuplicates: false 
        })
        .select('id, handle');

      if (error) {
        console.error(`❌ Error upserting batch ${i}-${i + batch.length}:`, error);
        throw error;
      }

      insertedCount += data?.length || 0;
      console.log(`✅ Processed batch ${i + 1}-${Math.min(i + batchSize, productsToUpsert.length)} of ${productsToUpsert.length}`);
    }

    // Clean up products that no longer exist in Shopify (if force is true)
    let deletedCount = 0;
    if (force) {
      const currentHandles = productsToUpsert.map(p => p.handle);
      
      const { data: deletedProducts, error: deleteError } = await supabase
        .from('products')
        .delete()
        .not('handle', 'in', `(${currentHandles.map(h => `'${h}'`).join(',')})`)
        .select('handle');

      if (deleteError) {
        console.error('❌ Error deleting obsolete products:', deleteError);
      } else {
        deletedCount = deletedProducts?.length || 0;
        console.log(`🗑️ Deleted ${deletedCount} obsolete products`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_shopify_products: allProducts.length,
        processed: insertedCount,
        deleted: deletedCount,
        sync_type: force ? 'full_sync_with_cleanup' : 'incremental_sync'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error syncing all products:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Sync a single product by handle
 */
async function syncSingleProduct(handle) {
  try {
    const query = `
      query getProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          handle
          title
          description
          productType
          vendor
          tags
          priceRange {
            minVariantPrice {
              amount
            }
            maxVariantPrice {
              amount
            }
          }
          variants(first: 250) {
            edges {
              node {
                id
              }
            }
          }
          featuredImage {
            url
          }
          createdAt
          updatedAt
        }
      }
    `;

    const variables = { handle };

    const response = await fetch(SHOPIFY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(`Shopify API error: ${JSON.stringify(result.errors)}`);
    }

    const product = result.data?.productByHandle;
    
    if (!product) {
      return NextResponse.json({
        success: false,
        error: `Product with handle "${handle}" not found in Shopify`
      }, { status: 404 });
    }

    const productData = {
      handle: product.handle,
      shopify_id: extractIdFromGid(product.id),
      shopify_graphql_id: product.id,
      title: product.title,
      description: product.description || null,
      product_type: product.productType || null,
      vendor: product.vendor || null,
      status: 'active', // Default to active since status field not available in Storefront API
      tags: product.tags || [],
      price_min: parseFloat(product.priceRange?.minVariantPrice?.amount || 0),
      price_max: parseFloat(product.priceRange?.maxVariantPrice?.amount || 0),
      variant_count: product.variants?.edges?.length || 0,
      image_url: product.featuredImage?.url || null,
      synced_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('products')
      .upsert(productData, { onConflict: 'handle' })
      .select('*');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      product: data[0],
      action: 'single_product_sync'
    });

  } catch (error) {
    console.error(`❌ Error syncing product "${handle}":`, error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Extract numeric ID from Shopify GraphQL ID
 * Example: "gid://shopify/Product/1234567890" -> "1234567890"
 */
function extractIdFromGid(gid) {
  if (!gid) return null;
  const parts = gid.split('/');
  return parts[parts.length - 1];
}

// GET endpoint for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  if (action === 'status') {
    try {
      const { data: productCount, error } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      const { data: recentSync, error: syncError } = await supabase
        .from('products')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1);

      return NextResponse.json({
        success: true,
        products_count: productCount?.length || 0,
        last_sync: recentSync?.[0]?.synced_at || null,
        sync_endpoint: '/api/products/sync',
        actions_available: ['sync_all', 'sync_single']
      });

    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: false,
    error: 'Invalid action. Use ?action=status'
  }, { status: 400 });
} 