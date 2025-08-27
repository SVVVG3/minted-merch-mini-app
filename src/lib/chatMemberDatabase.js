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
    
    // Fetch user data from Neynar for all FIDs
    const response = await fetch('/api/user-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fids })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profiles from Neynar');
    }

    const { profiles } = await response.json();
    
    if (!profiles || Object.keys(profiles).length === 0) {
      throw new Error('No user profiles found');
    }

    // Prepare chat member records
    const chatMembers = [];
    const errors = [];

    for (const fid of fids) {
      const profile = profiles[fid];
      
      if (!profile) {
        errors.push(`No profile found for FID ${fid}`);
        continue;
      }

      // Get wallet addresses from profile
      const walletAddresses = [];
      
      // Add custody address if available
      if (profile.custody_address) {
        walletAddresses.push(profile.custody_address);
      }
      
      // Add verified addresses if available
      if (profile.verified_addresses?.eth_addresses) {
        walletAddresses.push(...profile.verified_addresses.eth_addresses);
      }

      // Filter out duplicates and invalid addresses
      const uniqueWallets = [...new Set(walletAddresses)]
        .filter(addr => addr && addr.startsWith('0x') && addr.length === 42);

      chatMembers.push({
        fid: parseInt(fid),
        username: profile.username,
        display_name: profile.display_name,
        pfp_url: profile.pfp_url,
        wallet_addresses: uniqueWallets,
        added_at: new Date().toISOString(),
        is_active: true
      });
    }

    if (chatMembers.length === 0) {
      return {
        success: false,
        error: 'No valid chat members to add',
        errors
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
    const response = await fetch('/api/user-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fids: [fid] })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile from Neynar');
    }

    const { profiles } = await response.json();
    const profile = profiles[fid];
    
    if (!profile) {
      throw new Error(`No profile found for FID ${fid}`);
    }

    // Extract wallet addresses
    const walletAddresses = [];
    
    if (profile.custody_address) {
      walletAddresses.push(profile.custody_address);
    }
    
    if (profile.verified_addresses?.eth_addresses) {
      walletAddresses.push(...profile.verified_addresses.eth_addresses);
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
