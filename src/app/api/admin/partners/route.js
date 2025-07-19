import { NextResponse } from 'next/server';
import { getAllPartners, createPartner } from '@/lib/partnerAuth';
import { supabaseAdmin } from '@/lib/supabase';

// GET all partners (admin only)
export async function GET(request) {
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
}

// POST create new partner (admin only)
export async function POST(request) {
  try {
    const { name, email, password, fid } = await request.json();

    console.log('🤝 Creating new partner:', { name, email, fid });

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Name, email, and password are required'
      }, { status: 400 });
    }

    // Validate FID if provided
    const validatedFid = fid && fid !== '' ? parseInt(fid) : null;
    if (fid && fid !== '' && isNaN(validatedFid)) {
      return NextResponse.json({
        success: false,
        error: 'FID must be a valid number'
      }, { status: 400 });
    }

    const result = await createPartner(email, password, name, validatedFid);

    if (!result.success) {
      console.error('❌ Failed to create partner:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    console.log('✅ Partner created successfully:', result.partner.email);
    
    return NextResponse.json({
      success: true,
      data: result.partner,
      message: 'Partner created successfully'
    });

  } catch (error) {
    console.error('❌ Error in POST /api/admin/partners:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create partner'
    }, { status: 500 });
  }
} 