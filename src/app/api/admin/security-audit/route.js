import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const GET = withAdminAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const eventType = searchParams.get('event_type');
    const hours = parseInt(searchParams.get('hours')) || 24;

    // Calculate time range
    const timeAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabaseAdmin
      .from('security_audit_log')
      .select('*')
      .gte('created_at', timeAgo)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching security audit log:', error);
      return NextResponse.json(
        { error: 'Failed to fetch security events' },
        { status: 500 }
      );
    }

    // Get summary statistics
    const { data: summary, error: summaryError } = await supabaseAdmin
      .from('security_audit_log')
      .select('event_type, user_fid, created_at')
      .gte('created_at', timeAgo);

    let stats = {};
    if (!summaryError && summary) {
      stats = summary.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {});
    }

    return NextResponse.json({
      success: true,
      events: events || [],
      summary: {
        totalEvents: events?.length || 0,
        timeRange: `${hours} hours`,
        eventTypes: stats,
        mostRecentEvent: events?.[0]?.created_at || null
      }
    });

  } catch (error) {
    console.error('Error in security audit endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST endpoint to manually log security events (for testing)
export const POST = withAdminAuth(async (request, context) => {
  try {
    const { eventType, details, fid } = await request.json();

    if (!eventType) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { status: 400 }
      );
    }

    const { logSecurityEvent } = await import('@/lib/security');
    await logSecurityEvent(eventType, details || {}, fid, request);

    return NextResponse.json({
      success: true,
      message: 'Security event logged successfully'
    });

  } catch (error) {
    console.error('Error logging security event:', error);
    return NextResponse.json(
      { error: 'Failed to log security event' },
      { status: 500 }
    );
  }
});
