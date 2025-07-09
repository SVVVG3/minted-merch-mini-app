import { createClient } from '@supabase/supabase-js';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE_URL = 'https://api.neynar.com';

export async function POST(request) {
  try {
    if (!NEYNAR_API_KEY) {
      throw new Error('NEYNAR_API_KEY not found');
    }

    // Initialize Supabase client inside the function
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get all tokens from Neynar directly
    const neynarResponse = await fetch(`${NEYNAR_BASE_URL}/v2/farcaster/frame/notifications/tokens?url=https://api.farcaster.xyz/v1/frame-notifications`, {
      headers: {
        'x-api-key': NEYNAR_API_KEY
      }
    });

    if (!neynarResponse.ok) {
      throw new Error(`Neynar API error: ${neynarResponse.status}`);
    }

    const neynarData = await neynarResponse.json();
    const enabledTokens = neynarData.tokens.filter(token => token.status === 'enabled');
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