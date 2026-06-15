import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { getProductConfig } from '@/lib/designStudioConfig';

// Use service-role key — this route is already protected by Farcaster auth.
// Service role is kept strictly server-side and never exposed to the client.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  // 1. Authenticate the caller via Farcaster JWT
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fid = auth.fid;

  try {
    const {
      productId,       // e.g. 'tshirt' | 'hoodie' | 'hat'
      size,            // e.g. 'M' | 'One Size'
      colorName,       // e.g. 'Black'
      technique,       // 'DTG' | 'EMBROIDERY' | null
      designUrl,       // R2 URL for the uploaded design
      mockupUrl,       // R2 URL for the generated mockup
      placement,       // 'center' | 'leftchest'
      designScale,     // float 0–1
      printfulVariantIds,  // array of Printful variant IDs (for color)
      positionData,    // { area_width, area_height, width, height, top, left }
    } = await request.json();

    // Validate required fields
    if (!productId || !designUrl || !mockupUrl) {
      return NextResponse.json(
        { error: 'productId, designUrl, and mockupUrl are required' },
        { status: 400 }
      );
    }

    const productConfig = getProductConfig(productId);
    if (!productConfig) {
      return NextResponse.json({ error: 'Invalid product selection' }, { status: 400 });
    }

    // Insert and return the generated UUID
    const { data, error } = await supabase
      .from('design_order_requests')
      .insert({
        fid,
        product_type: productId,
        shopify_variant_id: productConfig.shopifyVariantId,
        size: size || null,
        color_name: colorName || null,
        technique: technique || productConfig.technique || 'DTG',
        design_url: designUrl,
        mockup_url: mockupUrl,
        placement: placement || productConfig.placement,
        design_scale: typeof designScale === 'number' ? designScale : null,
        printful_product_id: productConfig.printfulProductId,
        printful_variant_ids: printfulVariantIds || null,
        position_data: positionData || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ design_order_requests insert error:', error);
      return NextResponse.json({ error: 'Failed to save order request' }, { status: 500 });
    }

    console.log(`✅ Design order request saved — FID: ${fid}, product: ${productId}, id: ${data.id}`);
    return NextResponse.json({ id: data.id });

  } catch (err) {
    console.error('❌ save-order-request error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
