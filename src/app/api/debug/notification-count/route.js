import { createClient } from '@supabase/supabase-js';
import { neynarAxios } from '@/lib/neynar';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    // Get all tokens from Neynar to count enabled ones
    const neynarResponse = await neynarAxios.get('/farcaster/frame/notifications/tokens', {
      params: {
        url: 'https://api.farcaster.xyz/v1/frame-notifications'
      }
    });

    const enabledTokens = neynarResponse.data.tokens.filter(token => token.status === 'enabled');
    const neynarCount = enabledTokens.length;

    // Get count from our database
    const { data: dbUsers, error } = await supabase
      .from('users')
      .select('fid, username, has_notifications')
      .eq('has_notifications', true);

    if (error) {
      throw error;
    }

    const dbCount = dbUsers.length;

    // Get some examples of users with notifications in Neynar but not in our DB
    const neynarFids = new Set(enabledTokens.map(token => token.fid));
    const dbFids = new Set(dbUsers.map(user => user.fid));
    
    const missingInDb = Array.from(neynarFids).filter(fid => !dbFids.has(fid));
    const missingInNeynar = Array.from(dbFids).filter(fid => !neynarFids.has(fid));

    return Response.json({
      success: true,
      comparison: {
        neynar_count: neynarCount,
        database_count: dbCount,
        difference: neynarCount - dbCount,
        users_in_neynar_not_in_db: missingInDb.slice(0, 10), // First 10 examples
        users_in_db_not_in_neynar: missingInNeynar.slice(0, 10), // First 10 examples
        total_missing_in_db: missingInDb.length,
        total_missing_in_neynar: missingInNeynar.length
      },
      details: {
        neynar_enabled_tokens: enabledTokens.length,
        database_users_with_notifications: dbUsers.length
      }
    });

  } catch (error) {
    console.error('Notification count error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 