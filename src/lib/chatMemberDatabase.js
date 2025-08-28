// Chat member database management using existing profiles data

import { supabaseAdmin } from './supabase';

// Debug Supabase configuration
console.log('🔧 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('🔧 Supabase admin client configured:', !!supabaseAdmin);

/**
 * Add chat members by FID using existing profiles data
 * @param {Array} fids - Array of Farcaster IDs to add as chat members
 * @returns {Promise<Object>} Result of the operation
 */
export async function addChatMembersByFids(fids) {
  try {
    console.log('🔄 Adding chat members for FIDs:', fids);
    
    // Convert FIDs to integers for the query
    const fidInts = fids.map(fid => parseInt(fid));
    console.log('🔍 Querying profiles for FIDs:', fidInts);

    // DEBUGGING: Test direct query first
    console.log('🧪 Testing direct Supabase admin query...');
    const testQuery = await supabaseAdmin
      .from('profiles')
      .select('fid, username')
      .eq('fid', 466111);
    
    console.log('🧪 Direct test query result:', testQuery);

    // Fetch profile data directly from our profiles table
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('fid, username, display_name, pfp_url, custody_address, verified_eth_addresses, all_wallet_addresses')
      .in('fid', fidInts);

    if (profileError) {
      console.error('❌ Supabase profile query error:', profileError);
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    console.log(`📊 Found ${profiles?.length || 0} profiles for ${fids.length} FIDs`);
    console.log('📊 Profile data:', profiles);

    // Prepare chat member records
    const chatMembers = [];
    const errors = [];

    for (const fid of fidInts) {
      try {
        console.log(`🔍 Processing FID: ${fid} (type: ${typeof fid})`);
        
        const profile = profiles.find(p => p.fid === fid);
        
        if (!profile) {
          console.log(`❌ No profile found for FID ${fid}`);
          console.log(`🔍 Available profiles:`, profiles.map(p => ({ fid: p.fid, username: p.username })));
          errors.push(`No profile found for FID ${fid}`);
          continue;
        }
        
        console.log(`👤 Found profile for FID ${fid}:`, profile.username);

        // Extract wallet addresses from profile data
        const walletAddresses = [];
        
        // Add custody address
        if (profile.custody_address) {
          walletAddresses.push(profile.custody_address);
        }
        
        // Add verified ETH addresses
        if (profile.verified_eth_addresses && Array.isArray(profile.verified_eth_addresses)) {
          walletAddresses.push(...profile.verified_eth_addresses);
        }
        
        // Add all wallet addresses (this should include everything)
        if (profile.all_wallet_addresses && Array.isArray(profile.all_wallet_addresses)) {
          walletAddresses.push(...profile.all_wallet_addresses);
        }

        // Filter out duplicates and keep only valid ETH addresses
        console.log(`🔍 Raw wallet addresses for FID ${fid}:`, walletAddresses);
        
        const uniqueWallets = [...new Set(walletAddresses)]
          .filter(addr => {
            const isValid = addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42;
            if (!isValid && addr) {
              console.log(`❌ Filtered out invalid address: ${addr} (type: ${typeof addr}, length: ${addr.length})`);
            }
            return isValid;
          });

        console.log(`🔗 Found ${uniqueWallets.length} valid ETH wallet addresses for FID ${fid}:`, uniqueWallets);

        chatMembers.push({
          fid: fid, // Already an integer from fidInts
          username: profile.username,
          display_name: profile.display_name,
          pfp_url: profile.pfp_url,
          wallet_addresses: uniqueWallets,
          added_at: new Date().toISOString(),
          is_active: true
        });

        console.log(`✅ Successfully prepared data for FID ${fid} with ${uniqueWallets.length} wallets`);

      } catch (error) {
        console.error(`❌ Error processing FID ${fid}:`, error);
        errors.push(`Error processing FID ${fid}: ${error.message}`);
      }
    }

    console.log(`📊 Processing complete. Chat members prepared: ${chatMembers.length}, Errors: ${errors.length}`);
    console.log('📊 Prepared chat members:', chatMembers);
    console.log('📊 Errors encountered:', errors);

    if (chatMembers.length === 0) {
      console.log('❌ No valid chat members to add. Errors:', errors);
      return {
        success: false,
        error: 'No valid chat members to add',
        errors,
        debug: {
          totalFids: fids.length,
          processedMembers: chatMembers.length,
          errorCount: errors.length,
          profilesFound: profiles?.length || 0
        }
      };
    }

    // Insert/update into Supabase with reactivation logic
    const { data, error } = await supabaseAdmin
      .from('chat_members')
      .upsert(chatMembers.map(member => ({
        ...member,
        is_active: true, // Reactivate if they were previously removed
        removed_at: null // Clear removal timestamp
      })), { 
        onConflict: 'fid',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✅ Successfully added/updated chat members:', data.length);
    
    return {
      success: true,
      added: data.length,
      members: data,
      errors: errors.length > 0 ? errors : null
    };

  } catch (error) {
    console.error('❌ Error adding chat members:', error);
    return {
      success: false,
      error: error.message,
      added: 0
    };
  }
}

/**
 * Get all chat members with their wallet data from profiles
 * @returns {Promise<Array>} Array of chat members with wallet addresses
 */
export async function getChatMembers() {
  try {
    // Get chat members and join with profiles for fresh wallet data
    const { data, error } = await supabaseAdmin
      .from('chat_members')
      .select(`
        fid,
        username,
        display_name,
        added_at,
        profiles!inner(
          custody_address,
          verified_eth_addresses,
          all_wallet_addresses
        )
      `)
      .eq('is_active', true)
      .order('added_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`📊 Fetched ${data.length} active chat members with profile data`);

    // Transform data and extract wallet addresses from profiles
    return data.map(member => {
      const walletAddresses = [];
      
      // Add custody address
      if (member.profiles?.custody_address) {
        walletAddresses.push(member.profiles.custody_address);
      }
      
      // Add verified ETH addresses
      if (member.profiles?.verified_eth_addresses && Array.isArray(member.profiles.verified_eth_addresses)) {
        walletAddresses.push(...member.profiles.verified_eth_addresses);
      }
      
      // Add all wallet addresses
      if (member.profiles?.all_wallet_addresses && Array.isArray(member.profiles.all_wallet_addresses)) {
        walletAddresses.push(...member.profiles.all_wallet_addresses);
      }

      // Filter out duplicates and keep only valid ETH addresses
      const uniqueWallets = [...new Set(walletAddresses)]
        .filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42);

      console.log(`👤 Member ${member.username} (FID: ${member.fid}) has ${uniqueWallets.length} wallet addresses`);

      return {
        fid: member.fid,
        username: member.username,
        displayName: member.display_name,
        walletAddresses: uniqueWallets
      };
    });

  } catch (error) {
    console.error('❌ Error fetching chat members:', error);
    return [];
  }
}

/**
 * Remove a chat member (mark as inactive)
 * @param {number} fid - Farcaster ID to remove
 * @returns {Promise<Object>} Result of the operation
 */
export async function removeChatMember(fid) {
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_members')
      .update({ is_active: false, removed_at: new Date().toISOString() })
      .eq('fid', fid)
      .select();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      success: true,
      removed: data.length > 0
    };

  } catch (error) {
    console.error('❌ Error removing chat member:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update wallet addresses for a chat member
 * @param {number} fid - Farcaster ID
 * @returns {Promise<Object>} Result of the operation
 */
// Wallet refresh functions removed - we now use profiles data directly
// No need to maintain separate wallet data in chat_members table
