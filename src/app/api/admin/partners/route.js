import { NextResponse } from 'next/server';
import { getAllPartners, createPartner } from '@/lib/partnerAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

// GET all partners (admin only)
export const GET = withAdminAuth(async (request) => {
  try {
    console.log('🤝 Fetching all partners for admin dashboard...');

    const result = await getAllPartners();

    if (!result.success) {
      console.error('❌ Failed to fetch partners:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    // Enhance each partner with order statistics
    const partnersWithStats = await Promise.all(
      result.partners.map(async (partner) => {
        try {
          // Get order counts by status for this partner
          const { data: orderStats, error: statsError } = await supabaseAdmin
            .from('orders')
            .select('status')
            .eq('assigned_partner_id', partner.id);

          if (statsError) {
            console.warn(`⚠️ Could not fetch order stats for partner ${partner.id}:`, statsError);
            return {
              ...partner,
                          orderStats: {
              total: 0,
              assigned: 0,
              processing: 0,
              shipped: 0,
              vendor_paid: 0
            }
            };
          }

          // Count orders by status
          const statusCounts = orderStats.reduce((counts, order) => {
            counts[order.status] = (counts[order.status] || 0) + 1;
            return counts;
          }, {});

          const orderStatsForPartner = {
            total: orderStats.length,
            assigned: statusCounts.assigned || 0,
            processing: statusCounts.processing || 0,
            shipped: statusCounts.shipped || 0,
            vendor_paid: statusCounts.vendor_paid || 0
          };

          console.log(`📊 Partner ${partner.name} stats:`, orderStatsForPartner);

          return {
            ...partner,
            orderStats: orderStatsForPartner
          };
        } catch (error) {
          console.error(`❌ Error fetching stats for partner ${partner.id}:`, error);
          return {
            ...partner,
            orderStats: {
              total: 0,
              assigned: 0,
              processing: 0,
              shipped: 0,
              vendor_paid: 0
            }
          };
        }
      })
    );

    console.log(`✅ Retrieved ${partnersWithStats.length} partners with order statistics`);
    
    return NextResponse.json({
      success: true,
      data: partnersWithStats
    });

  } catch (error) {
    console.error('❌ Error in GET /api/admin/partners:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch partners'
    }, { status: 500 });
  }
});

// POST create new partner (admin only)
// Now uses Farcaster ID as primary authentication
export const POST = withAdminAuth(async (request) => {
  try {
    const { fid, name, username, partner_type } = await request.json();

    console.log('🤝 Creating new partner:', { fid, name, username, partner_type });

    // Validate required fields - FID is now required
    if (!fid) {
      return NextResponse.json({
        success: false,
        error: 'Farcaster ID is required'
      }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Name is required (should be auto-fetched from Farcaster)'
      }, { status: 400 });
    }

    // Validate FID
    const validatedFid = parseInt(fid);
    if (isNaN(validatedFid)) {
      return NextResponse.json({
        success: false,
        error: 'FID must be a valid number'
      }, { status: 400 });
    }

    // Check if partner with this FID already exists
    const { data: existingPartner, error: checkError } = await supabaseAdmin
      .from('partners')
      .select('id, name')
      .eq('fid', validatedFid)
      .single();

    if (existingPartner) {
      return NextResponse.json({
        success: false,
        error: `A partner with this Farcaster ID already exists: ${existingPartner.name}`
      }, { status: 400 });
    }

    // Validate partner_type
    const validPartnerType = partner_type || 'fulfillment';
    if (!['fulfillment', 'collab'].includes(validPartnerType)) {
      return NextResponse.json({
        success: false,
        error: 'Partner type must be either "fulfillment" or "collab"'
      }, { status: 400 });
    }

    // Create partner directly (no email/password needed for Farcaster auth)
    const { data: partner, error: insertError } = await supabaseAdmin
      .from('partners')
      .insert({
        fid: validatedFid,
        name,
        email: username ? `${username}@farcaster.local` : `fid${validatedFid}@farcaster.local`, // Placeholder email
        password_hash: null, // No password needed - Farcaster auth only
        partner_type: validPartnerType,
        is_active: true
      })
      .select('id, fid, name, email, partner_type, is_active, created_at')
      .single();

    if (insertError) {
      console.error('❌ Failed to create partner:', insertError);
      return NextResponse.json({
        success: false,
        error: insertError.message
      }, { status: 400 });
    }

    console.log('✅ Partner created successfully:', partner.name, `(FID: ${partner.fid})`);
    
    return NextResponse.json({
      success: true,
      data: partner,
      message: 'Partner created successfully'
    });

  } catch (error) {
    console.error('❌ Error in POST /api/admin/partners:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create partner'
    }, { status: 500 });
  }
}); 