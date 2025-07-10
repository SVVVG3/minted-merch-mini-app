// Helper function to fetch product titles from Shopify for existing orders
// that don't have title data in the database

const SHOPIFY_ADMIN_API_URL = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2023-10/graphql.json`;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

async function shopifyFetch(query, variables = {}) {
  const response = await fetch(SHOPIFY_ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

export async function enrichLineItemsWithProductTitles(lineItems) {
  if (!lineItems || lineItems.length === 0) {
    return lineItems;
  }

  // Check if any items are missing titles
  const itemsNeedingTitles = lineItems.filter(item => !item.title && !item.name && !item.productTitle);
  
  if (itemsNeedingTitles.length === 0) {
    return lineItems; // All items already have titles
  }

  try {
    // Extract variant IDs that need titles
    const variantIds = itemsNeedingTitles.map(item => item.id).filter(Boolean);
    
    if (variantIds.length === 0) {
      return lineItems; // No valid IDs to fetch
    }

    console.log('🔍 Fetching product titles for variants:', variantIds);

    // Fetch product data from Shopify
    const query = `
      query getProductVariants($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            title
            product {
              title
              handle
            }
          }
        }
      }
    `;

    const variables = {
      ids: variantIds
    };

    const data = await shopifyFetch(query, variables);
    
    // Create a mapping of variant ID to product info
    const variantMap = {};
    if (data.nodes) {
      data.nodes.forEach(node => {
        if (node && node.id) {
          variantMap[node.id] = {
            title: node.product?.title || 'Unknown Product',
            variantTitle: node.title !== 'Default Title' ? node.title : null
          };
        }
      });
    }

    console.log('✅ Fetched product data for', Object.keys(variantMap).length, 'variants');

    // Enrich the line items with product titles
    const enrichedLineItems = lineItems.map(item => {
      // If item already has a title, keep it
      if (item.title || item.name || item.productTitle) {
        return item;
      }

      // Try to get title from Shopify data
      const productData = variantMap[item.id];
      if (productData) {
        return {
          ...item,
          title: productData.title,
          variant: productData.variantTitle
        };
      }

      // Fallback to a generic title
      return {
        ...item,
        title: 'Product'
      };
    });

    return enrichedLineItems;

  } catch (error) {
    console.error('❌ Error fetching product titles from Shopify:', error);
    
    // Return original line items with fallback titles
    return lineItems.map((item, index) => ({
      ...item,
      title: item.title || item.name || item.productTitle || `Product ${index + 1}`
    }));
  }
} 