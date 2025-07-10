import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.js';
import { getUserDataFromNeynar } from '../../../../lib/neynar.js';
import { formatPSTTime } from '../../../../lib/timezone.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    
    console.log(`🔍 ${dryRun ? 'DRY RUN: ' : ''}Syncing missing notification users...`);
    
    // Fetch all notification tokens for our app from Neynar
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (!neynarApiKey) {
      throw new Error('NEYNAR_API_KEY not found');
    }
    
    console.log('📡 Fetching notification tokens from Neynar...');
    const response = await fetch(`https://api.neynar.com/v2/farcaster/app/notification-tokens`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${neynarApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Neynar API error: ${response.status} - ${errorText}`);
    }
    
    const neynarData = await response.json();
    console.log(`📊 Found ${neynarData.tokens?.length || 0} notification tokens from Neynar`);
    
    if (!neynarData.tokens || neynarData.tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No notification tokens found in Neynar',
        stats: { total: 0, existing: 0, missing: 0, created: 0 }
      });
    }
    
    // Get FIDs from the tokens
    const neynarFids = neynarData.tokens.map(token => token.fid).filter(Boolean);
    const uniqueNeynarFids = [...new Set(neynarFids)];
    
    console.log(`👥 Found ${uniqueNeynarFids.length} unique FIDs with notifications enabled in Neynar`);
    
    // Check which FIDs are already in our database
    const { data: existingProfiles, error: fetchError } = await supabase
      .from('profiles')
      .select('fid')
      .in('fid', uniqueNeynarFids);
    
    if (fetchError) {
      throw new Error(`Database error: ${fetchError.message}`);
    }
    
    const existingFids = existingProfiles.map(p => p.fid);
    const missingFids = uniqueNeynarFids.filter(fid => !existingFids.includes(fid));
    
    console.log(`📋 Analysis:`);
    console.log(`  - Total in Neynar: ${uniqueNeynarFids.length}`);
    console.log(`  - Already in DB: ${existingFids.length}`);
    console.log(`  - Missing from DB: ${missingFids.length}`);
    
    if (missingFids.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All users with notifications enabled are already in the database',
        stats: {
          total: uniqueNeynarFids.length,
          existing: existingFids.length,
          missing: 0,
          created: 0
        }
      });
    }
    
    console.log(`🔍 Missing FIDs: ${missingFids.join(', ')}`);
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'DRY RUN: Would create profiles for missing users',
        stats: {
          total: uniqueNeynarFids.length,
          existing: existingFids.length,
          missing: missingFids.length,
          created: 0
        },
        missingFids: missingFids
      });
    }
    
    // Create profiles for missing users
    let createdCount = 0;
    const createdProfiles = [];
    
    for (const fid of missingFids) {
      try {
        console.log(`👤 Creating profile for FID ${fid}...`);
        
        // Fetch user data from Neynar
        const userData = await getUserDataFromNeynar(fid);
        
        if (!userData) {
          console.warn(`⚠️ Could not fetch user data for FID ${fid}, creating minimal profile`);
        }
        
        const profileData = {
          fid: fid,
          username: userData?.username || null,
          display_name: userData?.display_name || null,
          bio: userData?.bio || null,
          pfp_url: userData?.pfp_url || null,
          custody_address: userData?.custody_address || null,
          verified_eth_addresses: userData?.verified_addresses?.eth_addresses || [],
          verified_sol_addresses: userData?.verified_addresses?.sol_addresses || [],
          primary_eth_address: userData?.verified_addresses?.primary?.[0] || null,
          all_wallet_addresses: [
            ...(userData?.custody_address ? [userData.custody_address.toLowerCase()] : []),
            ...(userData?.verified_addresses?.eth_addresses || []).map(addr => addr.toLowerCase()),
            ...(userData?.verified_addresses?.sol_addresses || []).map(addr => addr.toLowerCase())
          ],
          has_notifications: true, // They have notifications enabled in Neynar
          notification_status_updated_at: new Date().toISOString(),
          notification_status_source: 'neynar_sync'
        };
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select();
        
        if (createError) {
          console.error(`❌ Error creating profile for FID ${fid}:`, createError.message);
          continue;
        }
        
        createdCount++;
        createdProfiles.push(newProfile[0]);
        console.log(`✅ Created profile for ${userData?.username || `FID ${fid}`}`);
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing FID ${fid}:`, error.message);
      }
    }
    
    console.log(`🎉 Sync complete! Created ${createdCount} new profiles`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdCount} profiles for missing users`,
      stats: {
        total: uniqueNeynarFids.length,
        existing: existingFids.length,
        missing: missingFids.length,
        created: createdCount
      },
      createdProfiles: createdProfiles.map(p => ({
        fid: p.fid,
        username: p.username,
        display_name: p.display_name
      })),
      timestamp: formatPSTTime()
    });
    
  } catch (error) {
    console.error('❌ Error in sync-missing-notification-users:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 