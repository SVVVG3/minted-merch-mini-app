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
      .select('id, product_type, color_name, mockup_url, created_at')
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

    // Fetch the record first to verify ownership and get the R2 URL
    const { data: mockup, error: fetchErr } = await supabase
      .from('design_studio_mockups')
      .select('id, fid, mockup_url')
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

    // Delete the R2 object — await so it completes before the serverless fn exits.
    // Don't fail the request if R2 deletion errors (DB row is already gone).
    if (mockup.mockup_url) {
      const key = r2KeyFromUrl(mockup.mockup_url);
      console.log(`🪣 R2 delete attempt — mockup_url: "${mockup.mockup_url}", extracted key: "${key}"`);
      console.log(`   R2_PUBLIC_URL env: "${process.env.R2_PUBLIC_URL?.slice(0, 40)}...", R2_BUCKET_NAME: "${process.env.R2_BUCKET_NAME}"`);
      if (key) {
        try {
          await deleteFromR2(key);
          console.log(`✅ R2 object deleted: ${key}`);
        } catch (err) {
          // Most common causes:
          //   • R2 API token missing "Object:Delete" permission (add in Cloudflare dashboard)
          //   • Wrong bucket name / account ID env vars
          console.error(`❌ R2 delete FAILED for key "${key}": ${err.message}`);
          console.error('   Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        }
      } else {
        console.warn(`⚠️ Could not extract R2 key from URL: "${mockup.mockup_url}"`);
      }
    }

    console.log(`🗑️ Mockup deleted — id: ${id}, FID: ${auth.fid}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete mockup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
