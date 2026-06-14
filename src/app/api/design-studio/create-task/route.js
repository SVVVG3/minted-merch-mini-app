import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { createMockupTask, getPrintfiles } from '@/lib/printfulMockup';
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

    // Position is required by Printful. If the client didn't supply one (template
    // failed to load in the browser), fetch the printfile dimensions server-side
    // and build a default centered square position.
    let resolvedPosition = position || null;
    if (!resolvedPosition) {
      try {
        const printfilesData = await getPrintfiles(
          productConfig.printfulProductId,
          productConfig.technique || null
        );
        const printfiles = printfilesData?.printfiles || [];
        if (printfiles.length > 0) {
          const pf = printfiles[0];
          const aw = pf.width;
          const ah = pf.height;
          // Center a design that fills 90% of the shorter dimension
          const size = Math.round(Math.min(aw, ah) * 0.9);
          resolvedPosition = {
            area_width: aw,
            area_height: ah,
            width: size,
            height: size,
            top: Math.round((ah - size) / 2),
            left: Math.round((aw - size) / 2),
          };
          console.log(`📐 Using default position from printfile (${aw}×${ah}) for ${productConfig.label}`);
        }
      } catch (pfError) {
        console.warn('Could not fetch printfiles for default position:', pfError.message);
      }
    }

    const payload = {
      variant_ids: variantIds,
      format: 'png',
      files: [
        {
          placement: productConfig.placement,
          image_url: imageUrl,
          ...(resolvedPosition ? { position: resolvedPosition } : {}),
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
