import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { deleteFromR2, r2KeyFromUrl } from '@/lib/r2Storage';

export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: true, mockups: [] });
    }

    const { data, error } = await supabase
      .from('design_studio_mockups')
      .select('id, product_type, color_name, mockup_url, design_url, printful_variant_ids, position_data, placement, design_scale, technique, created_at')
      .eq('fid', auth.fid)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ success: true, mockups: data || [] });
  } catch (error) {
    console.error('Get mockups error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const auth = await verifyFarcasterUser(token);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Fetch the record first to verify ownership and get both R2 URLs
    const { data: mockup, error: fetchErr } = await supabase
      .from('design_studio_mockups')
      .select('id, fid, mockup_url, design_url')
      .eq('id', id)
      .single();

    if (fetchErr || !mockup) {
      return NextResponse.json({ error: 'Mockup not found' }, { status: 404 });
    }

    // Only allow the owner to delete their own mockups
    if (mockup.fid !== auth.fid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete from Supabase
    const { error: deleteErr } = await supabase
      .from('design_studio_mockups')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    // Delete both R2 objects — the generated mockup AND the original user design.
    // Both are stored in the same bucket; don't fail the request if R2 errors.
    const r2Urls = [
      mockup.mockup_url && { label: 'mockup', url: mockup.mockup_url },
      mockup.design_url && { label: 'design', url: mockup.design_url },
    ].filter(Boolean);

    for (const { label, url } of r2Urls) {
      const key = r2KeyFromUrl(url);
      if (!key) {
        console.warn(`⚠️ Could not extract R2 key for ${label}: "${url}"`);
        continue;
      }
      try {
        await deleteFromR2(key);
        console.log(`✅ R2 ${label} deleted: ${key}`);
      } catch (err) {
        console.error(`❌ R2 ${label} delete FAILED for key "${key}": ${err.message}`);
      }
    }

    console.log(`🗑️ Mockup deleted — id: ${id}, FID: ${auth.fid}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete mockup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
