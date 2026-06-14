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

    const topLevelTemplates = data?.templates || [];
    const variantMapping = data?.variant_mapping || [];
    console.log(`🖼️ Templates for product ${productId}: ${topLevelTemplates.length} templates, ${variantMapping.length} mappings. First mapping:`, JSON.stringify(variantMapping[0])?.substring(0, 200));

    // If a specific variantId is requested, find the matching template
    if (variantId) {
      const vid = parseInt(variantId);

      const mapping = variantMapping.find(m => m.variant_id === vid);

      // Shape A: mapping has a template_id field
      if (mapping?.template_id) {
        const template = topLevelTemplates.find(t => t.template_id === mapping.template_id);
        if (template) return NextResponse.json({ success: true, template });
      }

      // Shape B: mapping has a templates array — each entry is either a plain ID
      // or an object like { placement: 'front', template_id: 132947 }.
      if (Array.isArray(mapping?.templates) && mapping.templates.length > 0) {
        // Prefer the 'front' (or 'embroidery_front') placement; fall back to first entry
        const frontEntry =
          mapping.templates.find(t => t?.placement === 'front') ||
          mapping.templates.find(t => t?.placement === 'embroidery_front') ||
          mapping.templates[0];
        // Extract the numeric ID whether the entry is an object or a plain number
        const tmplId = (typeof frontEntry === 'object' && frontEntry !== null)
          ? frontEntry.template_id
          : frontEntry;
        const template = topLevelTemplates.find(t => t.template_id === tmplId);
        if (template) return NextResponse.json({ success: true, template });
      }

      // Fallback: return first available template regardless of variant
      const fallback = topLevelTemplates[0] || null;
      console.log(`⚠️ No exact template match for variantId ${vid} (found mapping: ${!!mapping}), using fallback:`, fallback?.template_id);
      return NextResponse.json({ success: true, template: fallback });
    }

    return NextResponse.json({ success: true, templates: topLevelTemplates, variantMapping });
  } catch (error) {
    console.error('Templates fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
