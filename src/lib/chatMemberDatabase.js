// Chat member database management using Neynar for wallet data

import { supabase } from './supabase';

/**
 * Add chat members by FID and fetch their wallet addresses from Neynar
 * @param {Array} fids - Array of Farcaster IDs to add as chat members
 * @returns {Promise<Object>} Result of the operation
 */
export async function addChatMembersByFids(fids) {
  try {
    console.log('🔄 Adding chat members for FIDs:', fids);
    
    // Prepare chat member records
    const chatMembers = [];
    const errors = [];

    // Fetch wallet data for each FID individually
    for (const fid of fids) {
      try {
        console.log(`🔍 Fetching data for FID: ${fid}`);
        
        // Get user profile data
        const profileResponse = await fetch('/api/user-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fids: [fid] })
        });

        if (!profileResponse.ok) {
          errors.push(`Failed to fetch profile for FID ${fid}`);
          continue;
        }

        const profileData = await profileResponse.json();
        console.log(`📊 Profile response for FID ${fid}:`, profileData);
        
        const profile = profileData.users?.[fid];
        
        if (!profile) {
          console.log(`❌ No profile found for FID ${fid}. Available users:`, Object.keys(profileData.users || {}));
          errors.push(`No profile found for FID ${fid}`);
          continue;
        }
        
        console.log(`👤 Found profile for FID ${fid}:`, profile.username);

        // Get wallet data
        const walletResponse = await fetch(`/api/user-wallet-data?fid=${fid}`);
        
        if (!walletResponse.ok) {
          errors.push(`Failed to fetch wallet data for FID ${fid}`);
          continue;
        }

        const walletResponseData = await walletResponse.json();
        console.log(`💰 Wallet response for FID ${fid}:`, walletResponseData);
        
        const walletData = walletResponseData.walletData;
        
        // Extract wallet addresses from wallet data
        const walletAddresses = [];
        
        if (walletData?.walletAddresses) {
          walletAddresses.push(...walletData.walletAddresses);
          console.log(`🔗 Found ${walletData.walletAddresses.length} wallet addresses for FID ${fid}`);
        } else {
          console.log(`❌ No wallet addresses found for FID ${fid}. WalletData:`, walletData);
        }

        // Filter out duplicates and invalid addresses
        const uniqueWallets = [...new Set(walletAddresses)]
          .filter(addr => addr && addr.startsWith('0x') && addr.length === 42);

        chatMembers.push({
          fid: parseInt(fid),
          username: profile.username,
          display_name: profile.display_name,
          pfp_url: profile.avatar_url, // Note: different field name from neynar
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

    if (chatMembers.length === 0) {
      console.log('❌ No valid chat members to add. Errors:', errors);
      return {
        success: false,
        error: 'No valid chat members to add',
        errors,
        debug: {
          totalFids: fids.length,
          processedMembers: chatMembers.length,
          errorCount: errors.length
        }
      };
    }

    // Insert into Supabase (you'll need to create this table)
    const { data, error } = await supabase
      .from('chat_members')
      .upsert(chatMembers, { 
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
 * Get all chat members from the database
 * @returns {Promise<Array>} Array of chat members
 */
export async function getChatMembers() {
  try {
    const { data, error } = await supabase
      .from('chat_members')
      .select('*')
      .eq('is_active', true)
      .order('added_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Transform data for compatibility with eligibility checker
    return data.map(member => ({
      fid: member.fid,
      username: member.username,
      displayName: member.display_name,
      walletAddresses: member.wallet_addresses || []
    }));

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
    const { data, error } = await supabase
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
export async function updateMemberWallets(fid) {
  try {
    // Fetch latest wallet data from Neynar
    const response = await fetch(`/api/user-wallet-data?fid=${fid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch wallet data from Neynar');
    }

    const { walletData } = await response.json();
    
    if (!walletData) {
      throw new Error(`No wallet data found for FID ${fid}`);
    }

    // Extract wallet addresses from wallet data
    const walletAddresses = [];
    
    if (walletData?.walletAddresses) {
      walletAddresses.push(...walletData.walletAddresses);
    }

    const uniqueWallets = [...new Set(walletAddresses)]
      .filter(addr => addr && addr.startsWith('0x') && addr.length === 42);

    // Update in database
    const { data, error } = await supabase
      .from('chat_members')
      .update({ 
        wallet_addresses: uniqueWallets,
        updated_at: new Date().toISOString()
      })
      .eq('fid', fid)
      .select();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      success: true,
      updated: data.length > 0,
      walletAddresses: uniqueWallets
    };

  } catch (error) {
    console.error('❌ Error updating member wallets:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
