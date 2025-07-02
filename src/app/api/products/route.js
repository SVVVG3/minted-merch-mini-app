import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const handle = searchParams.get('handle');
    const id = searchParams.get('id');
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    switch (action) {
      case 'list':
        return await listProducts(status, search, limit, offset);
        
      case 'get':
        if (handle) {
          return await getProductByHandle(handle);
        } else if (id) {
          return await getProductById(parseInt(id));
        } else {
          return NextResponse.json({
            success: false,
            error: 'Either handle or id parameter is required'
          }, { status: 400 });
        }
        
      case 'search':
        if (!search) {
          return NextResponse.json({
            success: false,
            error: 'search parameter is required'
          }, { status: 400 });
        }
        return await searchProducts(search, limit);
        
      case 'stats':
        return await getProductStats();
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: list, get, search, stats'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in products API:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * List products with filtering and pagination
 */
async function listProducts(status, search, limit, offset) {
  try {
    let query = supabase
      .from('products')
      .select(`
        id,
        handle,
        shopify_id,
        title,
        description,
        product_type,
        vendor,
        status,
        tags,
        price_min,
        price_max,
        variant_count,
        image_url,
        created_at,
        updated_at,
        synced_at
      `)
      .order('title', { ascending: true })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%, handle.ilike.%${search}%, description.ilike.%${search}%`);
    }

    const { data: products, error, count } = await query;

    if (error) {
      throw error;
    }

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', status === 'all' ? undefined : status);

    if (countError) {
      console.warn('Warning: Could not get total count:', countError);
    }

    return NextResponse.json({
      success: true,
      products: products || [],
      pagination: {
        limit,
        offset,
        total: totalCount || 0,
        has_more: (products?.length || 0) === limit
      },
      filters: {
        status,
        search
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Get product by handle
 */
async function getProductByHandle(handle) {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('handle', handle)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: `Product with handle "${handle}" not found`
        }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      product
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Get product by ID
 */
async function getProductById(id) {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: `Product with ID ${id} not found`
        }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      product
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Search products by text
 */
async function searchProducts(searchTerm, limit) {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        handle,
        title,
        description,
        product_type,
        vendor,
        status,
        price_min,
        price_max,
        image_url
      `)
      .or(`title.ilike.%${searchTerm}%, handle.ilike.%${searchTerm}%, description.ilike.%${searchTerm}%`)
      .eq('status', 'active')
      .order('title', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      products: products || [],
      search_term: searchTerm,
      count: products?.length || 0
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Get product statistics
 */
async function getProductStats() {
  try {
    // Total products by status
    const { data: statusStats, error: statusError } = await supabase
      .from('products')
      .select('status')
      .neq('status', null);

    if (statusError) {
      throw statusError;
    }

    const statusCounts = (statusStats || []).reduce((acc, { status }) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Product types
    const { data: typeStats, error: typeError } = await supabase
      .from('products')
      .select('product_type')
      .eq('status', 'active')
      .neq('product_type', null);

    if (typeError) {
      throw typeError;
    }

    const typeCounts = (typeStats || []).reduce((acc, { product_type }) => {
      if (product_type) {
        acc[product_type] = (acc[product_type] || 0) + 1;
      }
      return acc;
    }, {});

    // Recent sync info
    const { data: recentSync, error: syncError } = await supabase
      .from('products')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1);

    return NextResponse.json({
      success: true,
      stats: {
        total: statusStats?.length || 0,
        by_status: statusCounts,
        by_type: typeCounts,
        last_sync: recentSync?.[0]?.synced_at || null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST endpoint for managing products
export async function POST(request) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'create':
        return await createProduct(data);
        
      case 'update':
        return await updateProduct(data);
        
      case 'delete':
        return await deleteProduct(data.id || data.handle);
        
      case 'bulk_update_status':
        return await bulkUpdateStatus(data.ids, data.status);
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: create, update, delete, bulk_update_status'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in products POST:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Create a new product
 */
async function createProduct(productData) {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        ...productData,
        synced_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      product,
      action: 'created'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Update an existing product
 */
async function updateProduct(productData) {
  try {
    const { id, handle, ...updates } = productData;
    
    if (!id && !handle) {
      return NextResponse.json({
        success: false,
        error: 'Either id or handle is required for update'
      }, { status: 400 });
    }

    let query = supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select('*');

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('handle', handle);
    }

    const { data: product, error } = await query.single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      product,
      action: 'updated'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Delete a product
 */
async function deleteProduct(identifier) {
  try {
    if (!identifier) {
      return NextResponse.json({
        success: false,
        error: 'Product id or handle is required'
      }, { status: 400 });
    }

    let query = supabase.from('products').delete().select('*');
    
    if (typeof identifier === 'number') {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('handle', identifier);
    }

    const { data: deletedProduct, error } = await query.single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      deleted_product: deletedProduct,
      action: 'deleted'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Bulk update product status
 */
async function bulkUpdateStatus(productIds, newStatus) {
  try {
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Array of product IDs is required'
      }, { status: 400 });
    }

    if (!['active', 'archived', 'draft'].includes(newStatus)) {
      return NextResponse.json({
        success: false,
        error: 'Status must be one of: active, archived, draft'
      }, { status: 400 });
    }

    const { data: updatedProducts, error } = await supabase
      .from('products')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .in('id', productIds)
      .select('id, handle, title, status');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      updated_products: updatedProducts,
      count: updatedProducts?.length || 0,
      new_status: newStatus,
      action: 'bulk_status_update'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 