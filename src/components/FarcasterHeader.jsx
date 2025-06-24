'use client';

import { useFarcaster } from '@/lib/useFarcaster';

export function FarcasterHeader() {
  const { user, isLoading, isInFarcaster } = useFarcaster();

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // Don't render if not in Farcaster context
  if (!isInFarcaster || !user) {
    return null;
  }

  return (
    <div className="bg-purple-600 text-white px-4 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {user.pfpUrl && (
            <img 
              src={user.pfpUrl} 
              alt={user.displayName || user.username}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span>
            Hey {user.displayName || user.username}! 👋
          </span>
        </div>
        <div className="text-xs opacity-75">
          FID: {user.fid}
        </div>
      </div>
    </div>
  );
} 