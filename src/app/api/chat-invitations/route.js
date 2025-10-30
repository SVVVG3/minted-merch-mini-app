import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { fid, invitation_token, group_link, token_balance, generated_at } = await request.json();

    if (!fid || !invitation_token) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: fid and invitation_token'
      }, { status: 400 });
    }

    // Store invitation in database
    const { data, error } = await supabase
      .from('chat_invitations')
      .insert({
        fid: parseInt(fid),
        invitation_token,
        group_link,
        token_balance: parseFloat(token_balance) || 0,
        generated_at: generated_at || new Date().toISOString(),
        clicked: false,
        joined: false
      })
      .select();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      invitation: data[0]
    });

  } catch (error) {
    console.error('❌ Chat invitation API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const token = searchParams.get('token');

    if (token) {
      // Track click on invitation link
      const { data, error } = await supabase
        .from('chat_invitations')
        .update({ 
          clicked: true, 
          clicked_at: new Date().toISOString() 
        })
        .eq('invitation_token', token)
        .select();

      if (error) {
        console.error('Error tracking click:', error);
      }

      // Redirect to the actual group link
      return NextResponse.redirect('https://farcaster.xyz/~/group/f_3WBwjLNbY6K9khTauJog');
    }

    if (fid) {
      // Get invitations for a specific FID
      const { data, error } = await supabase
        .from('chat_invitations')
        .select('*')
        .eq('fid', parseInt(fid))
        .order('generated_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        invitations: data
      });
    }

    // Get all invitations (admin view)
    const { data, error } = await supabase
      .from('chat_invitations')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      invitations: data,
      count: data.length
    });

  } catch (error) {
    console.error('❌ Chat invitation GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
