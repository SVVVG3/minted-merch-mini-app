import { supabase } from '@/lib/supabase';
import { fetchNotificationTokensFromNeynar } from '@/lib/neynar';

export async function POST(request) {
  try {
    if (!supabase) {
      throw new Error('Supabase not available');
    }

    // Get all user FIDs from our database to check with Neynar
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('fid, username, has_notifications')
      .order('created_at', { ascending: false });

    if (profilesError) {
      throw new Error(`Database error: ${profilesError.message}`);
    }

    const allFids = allProfiles.map(p => p.fid);
    console.log(`Checking notification status for ${allFids.length} users`);

    // Get notification tokens from Neynar for all our users using existing function
    const neynarResult = await fetchNotificationTokensFromNeynar(allFids);
    
    if (!neynarResult.success) {
      throw new Error(`Neynar error: ${neynarResult.error}`);
    }

    const neynarTokens = neynarResult.tokens || [];
    const enabledTokens = neynarTokens.filter(token => token.status === 'enabled');
    
    // Create a set of FIDs that have enabled notifications in Neynar
    const neynarEnabledFids = new Set(enabledTokens.map(token => token.fid));
    
    // Count users in our database who have notifications marked as true
    const dbEnabledProfiles = allProfiles.filter(p => p.has_notifications === true);
    const databaseCount = dbEnabledProfiles.length;
    const neynarCount = neynarEnabledFids.size;
    const discrepancy = neynarCount - databaseCount;

    // Find mismatches
    const dbEnabledFids = new Set(dbEnabledProfiles.map(p => p.fid));
    const missingInDb = Array.from(neynarEnabledFids).filter(fid => !dbEnabledFids.has(fid));
    const missingInNeynar = Array.from(dbEnabledFids).filter(fid => !neynarEnabledFids.has(fid));

    // Get username info for missing users
    const missingInDbWithUsernames = missingInDb.map(fid => {
      const profile = allProfiles.find(p => p.fid === fid);
      const token = enabledTokens.find(t => t.fid === fid);
      return {
        fid,
        username: profile?.username || token?.username || 'unknown',
        dbStatus: profile?.has_notifications || false
      };
    });

    const missingInNeynarWithUsernames = missingInNeynar.map(fid => {
      const profile = allProfiles.find(p => p.fid === fid);
      return {
        fid,
        username: profile?.username || 'unknown',
        dbStatus: profile?.has_notifications
      };
    });

    return Response.json({
      success: true,
      neynarCount,
      databaseCount,
      discrepancy,
      analysis: {
        message: discrepancy > 0 
          ? `${discrepancy} users have notifications enabled in Neynar but not in our database`
          : discrepancy < 0
          ? `${Math.abs(discrepancy)} users have notifications in our database but not in Neynar`
          : 'Database and Neynar are in sync',
        totalUsersChecked: allFids.length,
        neynarTokensFound: neynarTokens.length,
        enabledTokensInNeynar: enabledTokens.length
      },
      mismatches: {
        usersEnabledInNeynarButNotInDb: missingInDbWithUsernames.slice(0, 15),
        usersEnabledInDbButNotInNeynar: missingInNeynarWithUsernames.slice(0, 15),
        totalMissingInDb: missingInDb.length,
        totalMissingInNeynar: missingInNeynar.length
      },
      samples: {
        neynarEnabledUsers: enabledTokens.slice(0, 10).map(token => ({
          fid: token.fid,
          username: token.username
        })),
        databaseEnabledUsers: dbEnabledProfiles.slice(0, 10).map(profile => ({
          fid: profile.fid,
          username: profile.username
        }))
      }
    });

  } catch (error) {
    console.error('Error in notification count comparison:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
} 