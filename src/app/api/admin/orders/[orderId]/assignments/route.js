import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';
import { sendPartnerAssignmentNotification, sendVendorPaidNotification } from '@/lib/neynar';

// GET: Fetch all partner assignments for an order
export const GET = withAdminAuth(async (request, { params }) => {
  try {
    const { orderId } = await params;
    const decodedOrderId = decodeURIComponent(orderId);
    
    console.log(`📋 Fetching partner assignments for order: ${decodedOrderId}`);
    
    const { data: assignments, error } = await supabaseAdmin
      .from('order_partner_assignments')
      .select(`
        *,
        partner:partners (
          id,
          name,
          email,
          fid,
          partner_type,
          is_active
        )
      `)
      .eq('order_id', decodedOrderId)
      .order('assigned_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching assignments:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, assignments });
  } catch (error) {
    console.error('Error in GET assignments:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});

// POST: Add a new partner assignment to an order
export const POST = withAdminAuth(async (request, { params }) => {
  try {
    const { orderId } = await params;
    const decodedOrderId = decodeURIComponent(orderId);
    const body = await request.json();
    
    const { partner_id, assignment_notes } = body;
    
    if (!partner_id) {
      return NextResponse.json({ success: false, error: 'partner_id is required' }, { status: 400 });
    }
    
    console.log(`➕ Adding partner ${partner_id} to order: ${decodedOrderId}`);
    
    // Check if assignment already exists
    const { data: existing } = await supabaseAdmin
      .from('order_partner_assignments')
      .select('id')
      .eq('order_id', decodedOrderId)
      .eq('partner_id', partner_id)
      .single();
    
    if (existing) {
      return NextResponse.json({ success: false, error: 'Partner is already assigned to this order' }, { status: 400 });
    }
    
    // Create the assignment
    const { data: assignment, error } = await supabaseAdmin
      .from('order_partner_assignments')
      .insert({
        order_id: decodedOrderId,
        partner_id,
        status: 'assigned',
        assignment_notes,
        assigned_at: new Date().toISOString()
      })
      .select(`
        *,
        partner:partners (
          id,
          name,
          email,
          fid,
          partner_type,
          is_active
        )
      `)
      .single();
    
    if (error) {
      console.error('Error creating assignment:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Send notification to the partner
    try {
      if (assignment.partner?.fid) {
        await sendPartnerAssignmentNotification(assignment.partner.fid, { orderId: decodedOrderId });
        console.log(`🔔 Sent assignment notification to partner FID ${assignment.partner.fid}`);
      }
    } catch (notifError) {
      console.warn('Failed to send assignment notification:', notifError);
    }
    
    console.log(`✅ Successfully assigned partner ${partner_id} to order ${decodedOrderId}`);
    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error('Error in POST assignment:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH: Update a partner assignment (status, tracking, payout)
export const PATCH = withAdminAuth(async (request, { params }) => {
  try {
    const { orderId } = await params;
    const decodedOrderId = decodeURIComponent(orderId);
    const body = await request.json();
    
    const { assignment_id, ...updateData } = body;
    
    if (!assignment_id) {
      return NextResponse.json({ success: false, error: 'assignment_id is required' }, { status: 400 });
    }
    
    console.log(`🔄 Updating assignment ${assignment_id} for order: ${decodedOrderId}`);
    
    // Get current assignment to check for status changes
    const { data: currentAssignment, error: fetchError } = await supabaseAdmin
      .from('order_partner_assignments')
      .select(`
        *,
        partner:partners (id, fid, name)
      `)
      .eq('id', assignment_id)
      .single();
    
    if (fetchError || !currentAssignment) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
    }
    
    // Build update object
    const updates = {};
    
    if (updateData.status !== undefined) {
      updates.status = updateData.status;
      
      // Set timestamps based on status
      if (updateData.status === 'shipped' && currentAssignment.status !== 'shipped') {
        updates.shipped_at = new Date().toISOString();
      }
      if (updateData.status === 'vendor_paid' && currentAssignment.status !== 'vendor_paid') {
        updates.vendor_paid_at = new Date().toISOString();
      }
    }
    
    // Tracking info
    if (updateData.tracking_number !== undefined) updates.tracking_number = updateData.tracking_number;
    if (updateData.tracking_url !== undefined) updates.tracking_url = updateData.tracking_url;
    if (updateData.carrier !== undefined) updates.carrier = updateData.carrier;
    
    // Payout info
    if (updateData.vendor_payout_amount !== undefined) {
      updates.vendor_payout_amount = updateData.vendor_payout_amount ? parseFloat(updateData.vendor_payout_amount) : null;
    }
    if (updateData.vendor_payout_internal_notes !== undefined) {
      updates.vendor_payout_internal_notes = updateData.vendor_payout_internal_notes;
    }
    if (updateData.vendor_payout_partner_notes !== undefined) {
      updates.vendor_payout_partner_notes = updateData.vendor_payout_partner_notes;
    }
    if (updateData.assignment_notes !== undefined) {
      updates.assignment_notes = updateData.assignment_notes;
    }
    
    // Perform update
    const { data: assignment, error } = await supabaseAdmin
      .from('order_partner_assignments')
      .update(updates)
      .eq('id', assignment_id)
      .select(`
        *,
        partner:partners (
          id,
          name,
          email,
          fid,
          partner_type,
          is_active
        )
      `)
      .single();
    
    if (error) {
      console.error('Error updating assignment:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Send vendor paid notification if status changed to vendor_paid
    if (updateData.status === 'vendor_paid' && currentAssignment.status !== 'vendor_paid') {
      try {
        if (assignment.partner?.fid) {
          await sendVendorPaidNotification(
            assignment.partner.fid,
            { orderId: decodedOrderId, amount: updates.vendor_payout_amount }
          );
          console.log(`💰 Sent vendor paid notification to partner FID ${assignment.partner.fid}`);
        }
      } catch (notifError) {
        console.warn('Failed to send vendor paid notification:', notifError);
      }
    }
    
    console.log(`✅ Successfully updated assignment ${assignment_id}`);
    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error('Error in PATCH assignment:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE: Remove a partner assignment
export const DELETE = withAdminAuth(async (request, { params }) => {
  try {
    const { orderId } = await params;
    const decodedOrderId = decodeURIComponent(orderId);
    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');
    
    if (!assignment_id) {
      return NextResponse.json({ success: false, error: 'assignment_id is required' }, { status: 400 });
    }
    
    console.log(`🗑️ Removing assignment ${assignment_id} from order: ${decodedOrderId}`);
    
    const { error } = await supabaseAdmin
      .from('order_partner_assignments')
      .delete()
      .eq('id', assignment_id)
      .eq('order_id', decodedOrderId);
    
    if (error) {
      console.error('Error deleting assignment:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    console.log(`✅ Successfully removed assignment ${assignment_id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE assignment:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});

