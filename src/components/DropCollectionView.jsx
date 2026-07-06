'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFarcaster } from '@/lib/useFarcaster';
import { ProductGrid } from './ProductGrid';
import { MERCH_MOGUL_STAKED_THRESHOLD, getSoleLeaderSubmissionId } from '@/lib/dropHelpers';

function CreatorAvatar({ username, fid, pfpUrl, size = 'sm' }) {
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const label = username || (fid ? String(fid) : 'creator');
  if (pfpUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={pfpUrl} alt="" className={`${dim} rounded-full object-cover flex-shrink-0`} />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-500`}>
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

function formatCountdown(endsAt) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  return `${hours}h ${mins}m left`;
}

export function DropCollectionView({ products }) {
  const { getSessionToken, user } = useFarcaster();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const loadStatus = useCallback(async () => {
    const token = getSessionToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const res = await fetch('/api/drops/status', { headers });
      const data = await res.json();
      setStatus(data);
      if (data.drop?.votingEndsAt) {
        setCountdown(formatCountdown(data.drop.votingEndsAt));
      }
    } catch {
      setStatus({ phase: 'none' });
    } finally {
      setLoading(false);
    }
  }, [getSessionToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, user?.fid]);

  useEffect(() => {
    if (!status?.drop?.votingEndsAt) return;
    const tick = () => setCountdown(formatCountdown(status.drop.votingEndsAt));
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [status?.drop?.votingEndsAt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]" />
      </div>
    );
  }

  const phase = status?.phase || 'none';
  const drop = status?.drop;
  const viewer = status?.viewer || {};
  const finalists = status?.finalists || [];
  const winner = status?.winner;

  if (phase === 'none') {
    return (
      <div className="px-4 py-12 text-center max-w-md mx-auto">
        <div className="text-4xl mb-3">🎯</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Limited Drops</h2>
        <p className="text-sm text-gray-500 mb-6">
          Community-curated weekly drops — 37 units each. Check back soon for the next drop.
        </p>
        <Link
          href="/create"
          className="inline-block px-6 py-3 bg-[#3eb489] text-white font-semibold rounded-2xl text-sm"
        >
          Create a Design →
        </Link>
      </div>
    );
  }

  if (phase === 'submissions') {
    return (
      <div className="px-4 py-8 max-w-md mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3eb489] mb-1">Now Open</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Limited Drop</h2>
          <p className="text-sm text-gray-500 mb-6">
            Submit your design for a chance to be this week&apos;s limited drop (37 units).
          </p>
          <Link href="/create" className="block w-full py-3.5 bg-[#3eb489] text-white font-semibold rounded-2xl text-sm mb-3">
            🎨 Create & Submit a Design
          </Link>
          <p className="text-xs text-gray-400">One submission per person per week</p>
        </div>
      </div>
    );
  }

  if (phase === 'voting') {
    const leaderId = getSoleLeaderSubmissionId(finalists);
    return (
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 mb-1">Voting Open</p>
          <h2 className="text-xl font-bold text-gray-900">Limited Drop</h2>
          <p className="text-sm text-gray-500 mt-1">Merch Moguls pick this week&apos;s winner</p>
          {countdown && (
            <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
              ⏱ {countdown}
            </span>
          )}
        </div>

        {viewer.isMogul ? (
          viewer.hasVoted ? (
            <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-xl text-center">
              ✅ Your vote is in — thanks for voting!
            </div>
          ) : (
            <Link
              href="/drops/vote"
              className="mb-6 flex items-center justify-center gap-2 w-full py-4 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-bold rounded-2xl text-base shadow-md transition-colors"
            >
              🗳 Cast Your Vote{viewer.voteWeight > 1 ? ` (${viewer.voteWeight} pts)` : ''}
            </Link>
          )
        ) : (
          <div className="mb-6 px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
            <p className="text-sm text-gray-600 mb-3">
              Only Merch Moguls ({MERCH_MOGUL_STAKED_THRESHOLD / 1_000_000}M+ $mintedmerch staked) can vote.
            </p>
            <Link href="/stake" className="inline-block px-5 py-2.5 bg-[#3eb489] text-white font-semibold rounded-xl text-sm">
              Stake to Become a Mogul →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 text-center">Finalists</p>
          {finalists.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">Finalists coming soon…</p>
          ) : (
            finalists.map((f) => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex gap-3 p-3">
                <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.mockupUrl} alt="" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-sm font-semibold text-gray-900 capitalize truncate">
                    {f.productType}{f.colorName ? ` · ${f.colorName}` : ''}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CreatorAvatar username={f.username} fid={f.fid} pfpUrl={f.pfpUrl} />
                    <p className="text-xs text-gray-500 truncate">@{f.username || f.fid || 'creator'}</p>
                  </div>
                  <p className="text-lg font-bold text-[#3eb489] mt-1">
                    {f.voteCount} <span className="text-xs font-normal text-gray-400">votes</span>
                    {leaderId === f.id && (
                      <span className="ml-2 text-xs text-yellow-600 font-semibold">👑</span>
                    )}
                  </p>
                </div>
                {viewer.userVoteSubmissionId === f.id && (
                  <span className="self-center text-xs font-semibold text-[#3eb489] px-2">Your pick</span>
                )}
              </div>
            ))
          )}
        </div>

        {viewer.isMogul && !viewer.hasVoted && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Tap <strong>Cast Your Vote</strong> above to choose your favorite
          </p>
        )}
      </div>
    );
  }

  if (phase === 'live') {
    const unitsLeft = Math.max(0, (drop.maxUnits || 37) - (drop.unitsSold || 0));
    return (
      <div>
        {winner?.mockupUrl && (
          <div className="px-4 pt-4 pb-2 max-w-lg mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={winner.mockupUrl} alt="Winning drop design" className="w-full aspect-square object-contain bg-gray-50" />
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">Live Now</p>
                <h2 className="text-lg font-bold text-gray-900">Limited Drop</h2>
                <div className="flex items-center gap-2 mt-2">
                  <CreatorAvatar username={winner.username} fid={winner.fid} pfpUrl={winner.pfpUrl} size="md" />
                  <p className="text-sm text-gray-500">
                    Designed by @{winner.username || 'creator'} · Only {unitsLeft} left of {drop.maxUnits}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {products?.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Drop is live — product listing coming to shop shortly.
          </div>
        )}
      </div>
    );
  }

  if (phase === 'sold_out') {
    return (
      <div className="px-4 py-12 text-center max-w-md mx-auto">
        <div className="text-4xl mb-3">🔥</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Limited Drop — Sold Out</h2>
        {winner?.mockupUrl && (
          <div className="w-48 h-48 mx-auto mb-4 rounded-xl overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={winner.mockupUrl} alt="" className="w-full h-full object-contain" />
          </div>
        )}
        <p className="text-sm text-gray-500">All {drop.maxUnits} units are gone. Watch for the next drop!</p>
      </div>
    );
  }

  return <ProductGrid products={products} />;
}
