import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { createMockupTask } from '@/lib/printfulMockup';
import { getProductConfig } from '@/lib/designStudioConfig';

export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { productId, variantIds, imageUrl, position } = await request.json();

    const productConfig = getProductConfig(productId);
    if (!productConfig) {
      return NextResponse.json({ error: 'Invalid product selection' }, { status: 400 });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'Design image URL is required' }, { status: 400 });
    }

    if (!variantIds || variantIds.length === 0) {
      return NextResponse.json({ error: 'Color variant is required' }, { status: 400 });
    }

    const payload = {
      variant_ids: variantIds,
      format: 'png',
      files: [
        {
          placement: productConfig.placement,
          image_url: imageUrl,
          ...(position ? { position } : {}),
        },
      ],
    };

    // Pass technique for embroidery products (hats)
    if (productConfig.technique) {
      payload.product_options = { technique: productConfig.technique };
    }

    const result = await createMockupTask(productConfig.printfulProductId, payload);

    console.log(`🎨 Mockup task created — FID: ${auth.fid}, product: ${productConfig.label}, task: ${result.task_key}`);

    return NextResponse.json({ success: true, taskKey: result.task_key, status: result.status });
  } catch (error) {
    console.error('Create mockup task error:', error);
    return NextResponse.json({ error: error.message || 'Failed to start mockup generation' }, { status: 500 });
  }
}
