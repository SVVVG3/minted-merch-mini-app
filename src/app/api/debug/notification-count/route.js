import { supabase } from '@/lib/supabase';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE_URL = 'https://api.neynar.com';

export async function POST(request) {
  try {
    if (!NEYNAR_API_KEY) {
      throw new Error('NEYNAR_API_KEY not found');
    }

    if (!supabase) {
      throw new Error('Supabase not available');
    }

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

    // Get count from our database (profiles table)
    const { data: dbProfiles, error } = await supabase
      .from('profiles')
      .select('fid, username, has_notifications')
      .eq('has_notifications', true);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const databaseCount = dbProfiles?.length || 0;
    const discrepancy = neynarCount - databaseCount;

    // Get sample of users with mismatched status (first 10)
    const { data: allProfiles, error: allError } = await supabase
      .from('profiles')
      .select('fid, username, has_notifications')
      .limit(100);

    if (allError) {
      console.warn('Could not fetch all profiles for mismatch analysis:', allError);
    }

    return Response.json({
      success: true,
      neynarCount,
      databaseCount,
      discrepancy,
      summary: {
        message: discrepancy > 0 
          ? `${discrepancy} users have notifications enabled in Neynar but not in our database`
          : discrepancy < 0
          ? `${Math.abs(discrepancy)} users have notifications in our database but not in Neynar`
          : 'Database and Neynar are in sync',
        neynarUsers: enabledTokens.slice(0, 10).map(token => ({
          fid: token.fid,
          username: token.username
        })),
        databaseUsers: dbProfiles?.slice(0, 10).map(profile => ({
          fid: profile.fid,
          username: profile.username
        })) || []
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