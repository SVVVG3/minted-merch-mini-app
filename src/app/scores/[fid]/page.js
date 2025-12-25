import { supabaseAdmin } from '@/lib/supabase';
import ScoresClient from './ScoresClient';

export async function generateMetadata({ params }) {
  const { fid } = await params;
  
  // Fetch user data for OG image
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username, pfp_url, neynar_score, quotient_score, mojo_score')
    .eq('fid', fid)
    .single();
  
  const username = profile?.username || 'User';
  const pfpUrl = profile?.pfp_url || '';
  const neynarScore = profile?.neynar_score || '0.00';
  const quotientScore = profile?.quotient_score || '0.00';
  // Mojo score will be added later when ready
  // const mojoScore = profile?.mojo_score;
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://app.mintedmerch.shop';
  
  // Build OG image URL (without Mojo for now)
  const ogParams = new URLSearchParams({
    username,
    pfpUrl: pfpUrl || '',
    neynar: neynarScore,
    quotient: quotientScore,
  });
  const ogImageUrl = `${baseUrl}/api/og/profile-scores?${ogParams.toString()}`;
  
  // Build scores text for description (without Mojo for now)
  const scoresText = `Neynar: ${parseFloat(neynarScore).toFixed(2)} | Quotient: ${parseFloat(quotientScore).toFixed(2)}`;
  
  const title = `${username}'s Minted Merch Scores`;
  const description = `Check out @${username}'s scores on Minted Merch! ${scoresText}`;

  // Frame metadata for mini app embed
  const frameMetadata = {
    version: 'next',
    imageUrl: ogImageUrl,
    button: {
      title: 'Check My Scores',
      action: {
        type: 'launch_frame',
        name: 'Minted Merch',
        url: `${baseUrl}?showProfile=true`,
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: '#000000',
      },
    },
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImageUrl],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    other: {
      'fc:frame': JSON.stringify(frameMetadata),
    },
  };
}

export default async function ScoresPage({ params }) {
  const { fid } = await params;
  return <ScoresClient fid={fid} />;
}

