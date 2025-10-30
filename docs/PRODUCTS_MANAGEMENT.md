# Products Management System

This document explains how to use the new Supabase products table for managing discount targeting and product data synchronization.

## Overview

The products management system provides a centralized way to manage Shopify product data in Supabase, enabling easier discount creation, better performance, and more flexible product targeting.

## Database Schema

### Products Table

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  shopify_id TEXT UNIQUE NOT NULL,
  shopify_graphql_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  product_type TEXT,
  vendor TEXT,
  status TEXT DEFAULT 'active',
  tags TEXT[],
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  variant_count INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Discount Codes Updates

```sql
-- Added new column for products table integration
ALTER TABLE discount_codes 
ADD COLUMN target_product_ids INTEGER[];
```

## API Endpoints

### 1. Products Sync API (`/api/products/sync`)

Synchronizes Shopify products to the Supabase products table.

#### Sync All Products
```bash
POST /api/products/sync
Content-Type: application/json

{
  "action": "sync_all",
  "force": false
}
```

#### Sync Single Product
```bash
POST /api/products/sync
Content-Type: application/json

{
  "action": "sync_single",
  "handle": "fren-trunks"
}
```

#### Get Sync Status
```bash
GET /api/products/sync?action=status
```

### 2. Products Query API (`/api/products`)

Query and manage products in the Supabase table.

#### List Products
```bash
GET /api/products?action=list&status=active&limit=50&offset=0
```

#### Get Product by Handle
```bash
GET /api/products?action=get&handle=fren-trunks
```

#### Get Product by ID
```bash
GET /api/products?action=get&id=123
```

#### Search Products
```bash
GET /api/products?action=search&search=fren&limit=10
```

#### Get Product Statistics
```bash
GET /api/products?action=stats
```

## Token-Gated Discount Integration

### Creating Product-Specific Discounts

The new system supports both legacy and new approaches:

#### Using Helper Function (Recommended)
```javascript
import { getProductIdByHandle } from '@/lib/tokenGating';

// Get Supabase product ID for easy targeting
const frenTrunksId = await getProductIdByHandle('fren-trunks');

const discountData = {
  code: 'FRENWHALE50',
  discount_type: 'percentage',
  discount_value: 50,
  discount_scope: 'product',
  target_product_ids: [frenTrunksId], // NEW: Supabase products table IDs
  gating_type: 'nft_holding',
  contract_addresses: ['0x123b30E25973FeCd8354dd5f41Cc45A3065eF88C'],
  // ... other fields
};
```

#### Manual Approach
```javascript
// 1. First ensure product is synced
await fetch('/api/products/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'sync_single',
    handle: 'product-handle'
  })
});

// 2. Get product details
const response = await fetch('/api/products?action=get&handle=product-handle');
const { product } = await response.json();

// 3. Create discount using product.id
const discountData = {
  target_product_ids: [product.id],
  // ... other fields
};
```

### Scope Checking

The token-gating system now automatically handles both new and legacy product targeting:

```javascript
// System checks in this order:
// 1. target_product_ids (new Supabase products table IDs)
// 2. target_products (legacy Shopify product IDs) 
// 3. Falls back gracefully if neither is available
```

## Workflow Examples

### Setting Up a New Product-Specific Discount

1. **Sync Product to Table** (if not already synced):
   ```bash
   curl -X POST https://mintedmerch.vercel.app/api/products/sync \
     -H "Content-Type: application/json" \
     -d '{"action": "sync_single", "handle": "fren-trunks"}'
   ```

2. **Get Product ID**:
   ```bash
   curl "https://mintedmerch.vercel.app/api/products?action=get&handle=fren-trunks"
   ```

3. **Create Token-Gated Discount** using debug endpoint:
   ```bash
   curl "https://mintedmerch.vercel.app/api/debug/token-gated-test?action=create_fren_discount"
   ```

### Bulk Product Management

1. **Sync All Products**:
   ```bash
   curl -X POST https://mintedmerch.vercel.app/api/products/sync \
     -H "Content-Type: application/json" \
     -d '{"action": "sync_all", "force": true}'
   ```

2. **View Products Statistics**:
   ```bash
   curl "https://mintedmerch.vercel.app/api/products?action=stats"
   ```

3. **Search Products**:
   ```bash
   curl "https://mintedmerch.vercel.app/api/products?action=search&search=trunks"
   ```

## Benefits

### Before (Legacy System)
- ❌ Manual Shopify product ID lookups
- ❌ Hardcoded product references  
- ❌ No centralized product management
- ❌ Difficult bulk operations
- ❌ No product metadata caching

### After (New Products Table)
- ✅ Easy product targeting by handle
- ✅ Automatic product synchronization
- ✅ Centralized product management
- ✅ Efficient bulk operations
- ✅ Product metadata readily available
- ✅ Better performance (cached data)
- ✅ Backward compatibility maintained

## Migration Guide

Existing discounts using `target_products` (Shopify IDs) will continue to work. The system automatically falls back to legacy mode if new `target_product_ids` are not available.

To migrate existing discounts:

1. Sync all products to the table
2. Update discount records to use `target_product_ids`
3. Optionally remove `target_products` after migration

## Maintenance

### Regular Sync
Run periodic syncs to keep the products table up to date:

```bash
# Daily sync (recommended)
curl -X POST /api/products/sync -d '{"action": "sync_all"}'

# Full sync with cleanup (weekly)
curl -X POST /api/products/sync -d '{"action": "sync_all", "force": true}'
```

### Monitoring
- Check sync status: `GET /api/products/sync?action=status`
- View product stats: `GET /api/products?action=stats`
- Monitor product counts and last sync timestamps

## Troubleshooting

### Product Not Found
If a product isn't found during discount creation:
1. Check if product exists in Shopify
2. Sync the specific product: `POST /api/products/sync {"action": "sync_single", "handle": "product-handle"}`
3. Verify the product appears in the table: `GET /api/products?action=get&handle=product-handle`

### Discount Not Applying
If product-specific discounts aren't applying:
1. Check discount `target_product_ids` vs actual product IDs
2. Verify product scope matching in console logs
3. Ensure product is active: `status = 'active'`

### Performance Issues
- Products table has indexes on `handle`, `shopify_id`, `status`, and `synced_at`
- Use pagination for large product lists
- Consider caching frequently accessed product data 