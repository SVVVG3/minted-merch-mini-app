import { Suspense } from 'react';
import DropsVoteClient from './DropsVoteClient';

export async function generateMetadata() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
  return {
    title: 'Vote — Limited Drop | Minted Merch',
    description: 'Merch Moguls vote on this week\'s Limited Drop finalists.',
    metadataBase: new URL(baseUrl),
  };
}

export default function DropsVotePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3eb489]" />
      </div>
    }>
      <DropsVoteClient />
    </Suspense>
  );
}
