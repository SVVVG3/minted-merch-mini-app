import { NextResponse } from 'next/server';
import { verifyFarcasterUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
