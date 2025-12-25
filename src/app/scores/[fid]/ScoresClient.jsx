'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ScoresClient({ fid }) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main page with profile modal open
    router.replace('/?showProfile=true');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
        <p>Loading your scores...</p>
      </div>
    </div>
  );
}

