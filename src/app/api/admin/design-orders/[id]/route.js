import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';
import { createPrintfulTemplate } from '@/lib/printfulTemplates';

export const PATCH = withAdminAuth(async (request, { params }) => {
  try {
    const { id } = params;
    const body = await request.json();

    if (body.retryPrintful !== true) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const { data: designOrder, error: fetchErr } = await supabaseAdmin
      .from('design_order_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !designOrder) {
      return NextResponse.json({ error: 'Design order not found' }, { status: 404 });
    }

    if (designOrder.drop_id && !designOrder.drop_submission_id) {
      return NextResponse.json(
        {
          error:
            'Limited drop purchases share one listing Printful draft. Retry from the Weekly Drops tab instead.',
        },
        { status: 400 }
      );
    }

    if (!designOrder.shopify_order_number && !designOrder.shopify_order_id) {
      return NextResponse.json(
        { error: 'Cannot retry Printful until the Shopify order is paid' },
        { status: 400 }
      );
    }

    if (
      designOrder.printful_order_id &&
      designOrder.printful_order_status !== 'failed'
    ) {
      return NextResponse.json(
        {
          error: `Printful draft #${designOrder.printful_order_id} already exists`,
          printfulOrderId: designOrder.printful_order_id,
        },
        { status: 400 }
      );
    }

    if (designOrder.printful_order_status === 'failed') {
      await supabaseAdmin
        .from('design_order_requests')
        .update({
          printful_order_id: null,
          printful_order_status: null,
          printful_template_id: null,
        })
        .eq('id', id);
    }

    const printful = await createPrintfulTemplate(
      id,
      designOrder.shopify_order_id || null,
      designOrder.shopify_order_number || null,
      { forceRetry: true }
    );

    if (!printful.success) {
      return NextResponse.json(
        { success: false, error: printful.error || 'Printful retry failed', printful },
        { status: 500 }
      );
    }

    const { data: updatedOrder } = await supabaseAdmin
      .from('design_order_requests')
      .select('id, printful_order_id, printful_order_status')
      .eq('id', id)
      .single();

    return NextResponse.json({
      success: true,
      printful,
      designOrder: updatedOrder,
    });
  } catch (err) {
    console.error('[admin/design-orders/[id]] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
