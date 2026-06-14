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

    console.log(`🖼️ Templates raw response for product ${productId}:`, JSON.stringify(data)?.substring(0, 500));

    // Printful may return templates in two possible shapes:
    //   A) { templates: [...], variant_mapping: [{ variant_id, template_id }] }
    //   B) { variant_mapping: [{ variant_id, templates: [...] }] }
    // Handle both.
    const topLevelTemplates = data?.templates || [];
    const variantMapping = data?.variant_mapping || [];

    // If a specific variantId is requested, find the matching template
    if (variantId) {
      const vid = parseInt(variantId);

      // Shape A: variant_mapping entry has a template_id pointing to top-level templates array
      const mappingA = variantMapping.find(m => m.variant_id === vid);
      if (mappingA?.template_id) {
        const template = topLevelTemplates.find(t => t.template_id === mappingA.template_id);
        if (template) return NextResponse.json({ success: true, template });
      }

      // Shape B: variant_mapping entry has an inline templates array
      if (mappingA?.templates?.length > 0) {
        const tmplId = mappingA.templates[0];
        const template = topLevelTemplates.find(t => t.template_id === tmplId) || null;
        return NextResponse.json({ success: true, template });
      }

      // Fallback: return first available template
      const fallback = topLevelTemplates[0] || null;
      console.log(`⚠️ No exact template match for variantId ${vid}, using fallback:`, fallback?.template_id);
      return NextResponse.json({ success: true, template: fallback });
    }

    return NextResponse.json({ success: true, templates: topLevelTemplates, variantMapping });
  } catch (error) {
    console.error('Templates fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
