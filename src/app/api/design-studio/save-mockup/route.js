import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { mockupUrl, productType, colorName, designUrl } = await request.json();
    if (!mockupUrl) {
      return NextResponse.json({ error: 'mockupUrl is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const { data, error } = await supabase
      .from('design_studio_mockups')
      .insert({
        fid: auth.fid,
        product_type: productType || 'unknown',
        color_name: colorName || null,
        mockup_url: mockupUrl,
        design_url: designUrl || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    console.log(`💾 Mockup saved for FID ${auth.fid}: ${data.id}`);
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Save mockup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
