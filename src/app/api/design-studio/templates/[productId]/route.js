import { NextResponse } from 'next/server';
import { getLayoutTemplates } from '@/lib/printfulMockup';

// Public endpoint — no auth required (just catalog data)
export async function GET(request, { params }) {
  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get('variantId');
  const technique = searchParams.get('technique');

  try {
    const { productId } = await params;
    const data = await getLayoutTemplates(productId, technique || null);

    const templates = data?.templates || [];
    const variantMapping = data?.variant_mapping || [];

    // If a specific variantId is requested, return just that template
    if (variantId) {
      const mapping = variantMapping.find(m => m.variant_id === parseInt(variantId));
      if (mapping) {
        const template = templates.find(t => t.template_id === mapping.template_id);
        return NextResponse.json({ success: true, template: template || null });
      }
      // Fallback: return first template
      return NextResponse.json({ success: true, template: templates[0] || null });
    }

    return NextResponse.json({ success: true, templates, variantMapping });
  } catch (error) {
    console.error('Templates fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
