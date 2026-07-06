'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFarcaster } from '@/lib/useFarcaster';
import { MERCH_MOGUL_STAKED_THRESHOLD, getSoleLeaderSubmissionId } from '@/lib/dropHelpers';

function CreatorAvatar({ username, fid, pfpUrl }) {
  const label = username || (fid ? String(fid) : '?');
  if (pfpUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={pfpUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

function formatCountdown(endsAt) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Voting ended';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  return `${hours}h ${mins}m left`;
}

export default function DropsVoteClient() {
  const { user, getSessionToken } = useFarcaster();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [stakedBalance, setStakedBalance] = useState(0);
  const [voteWeight, setVoteWeight] = useState(1);
  const [isWhale, setIsWhale] = useState(false);
  const [drop, setDrop] = useState(null);
  const [finalists, setFinalists] = useState([]);
  const [userVote, setUserVote] = useState(null);
  const [votingId, setVotingId] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const loadVoteData = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      setError('Please sign in with Farcaster to vote.');
      setLoading(false);
      return;
    }

    setError('');
    try {
      const res = await fetch('/api/drops/vote', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.status === 403) {
        setForbidden(true);
        setStakedBalance(data.stakedBalance || 0);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Failed to load voting data');

      setDrop(data.drop);
      setFinalists(data.finalists || []);
      setUserVote(data.userVote);
      setVoteWeight(data.voteWeight || 1);
      setIsWhale(!!data.isWhale);
      setStakedBalance(data.stakedBalance || 0);
      setCountdown(data.drop?.votingEndsAt ? formatCountdown(data.drop.votingEndsAt) : null);
    } catch (err) {
      setError(err.message || 'Failed to load voting data');
    } finally {
      setLoading(false);
    }
  }, [getSessionToken]);

  useEffect(() => {
    if (user?.fid) loadVoteData();
    else if (user === null) {
      setLoading(false);
      setError('Please sign in with Farcaster to vote.');
    }
  }, [user?.fid, loadVoteData, user]);

  useEffect(() => {
    if (!drop?.votingEndsAt) return;
    const tick = () => setCountdown(formatCountdown(drop.votingEndsAt));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [drop?.votingEndsAt]);

  const handleVote = async (submissionId) => {
    const token = getSessionToken();
    if (!token) return;

    setVotingId(submissionId);
    setError('');
    try {
      const res = await fetch('/api/drops/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to vote');

      setDrop(data.drop);
      setFinalists(data.finalists || []);
      setUserVote(data.userVote);
    } catch (err) {
      setError(err.message || 'Failed to vote');
    } finally {
      setVotingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3eb489]" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Merch Moguls Only</h1>
          <p className="text-sm text-gray-500 mb-4">
            Stake {(MERCH_MOGUL_STAKED_THRESHOLD / 1_000_000).toFixed(0)}M+ $mintedmerch to vote on Limited Drop finalists.
          </p>
          <p className="text-lg font-semibold text-gray-800 mb-6">
            Your staked: {(stakedBalance / 1_000_000).toFixed(1)}M
          </p>
          <Link href="/stake" className="block w-full py-3 bg-[#3eb489] text-white font-semibold rounded-2xl mb-3">
            Stake to Unlock →
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Back to Shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-bold text-gray-900 flex-1">Limited Drop Vote</h1>
      </div>

      <div className="px-4 pt-6 max-w-lg mx-auto">
        {!drop ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <div className="text-4xl mb-3">⏳</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Active Vote</h2>
            <p className="text-sm text-gray-500">
              Voting isn&apos;t open yet. Check back after the admin opens voting for this week&apos;s drop.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Limited Drop</h2>
              <p className="text-sm text-gray-500 mt-1">
                Pick your favorite finalist — votes are live.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                  {isWhale ? `🐋 ${voteWeight} votes (Whale)` : `1 vote`}
                </span>
                {countdown && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                    ⏱ {countdown}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                {error}
              </div>
            )}

            {userVote && (
              <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl font-medium">
                ✅ You voted ({userVote.voteWeight} vote{userVote.voteWeight !== 1 ? 's' : ''} counted)
              </div>
            )}

            <div className="space-y-4">
              {finalists.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No finalists selected yet.</p>
              ) : (
                finalists.map((f) => {
                  const isVoted = userVote?.submissionId === f.id;
                  const leaderId = getSoleLeaderSubmissionId(finalists);
                  const isLeading = leaderId === f.id;
                  return (
                    <div
                      key={f.id}
                      className={`bg-white rounded-2xl overflow-hidden shadow-sm border-2 ${
                        isVoted ? 'border-[#3eb489]' : 'border-gray-100'
                      }`}
                    >
                      <div className="relative aspect-square bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.mockupUrl} alt="Finalist design" className="w-full h-full object-contain" />
                        {isLeading && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                            👑 Leading
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                              {f.productType}{f.colorName ? ` · ${f.colorName}` : ''}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <CreatorAvatar username={f.username} fid={f.fid} pfpUrl={f.pfpUrl} />
                              <p className="text-xs text-gray-500">@{f.username || f.fid}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#3eb489]">{f.voteCount}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">votes</p>
                          </div>
                        </div>
                        {!userVote ? (
                          <button
                            onClick={() => handleVote(f.id)}
                            disabled={!!votingId}
                            className="w-full py-3 bg-[#6A3CFF] hover:bg-[#5A2FE6] disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
                          >
                            {votingId === f.id ? 'Submitting…' : `Vote (${voteWeight} pt${voteWeight !== 1 ? 's' : ''})`}
                          </button>
                        ) : isVoted ? (
                          <div className="w-full py-3 text-center text-sm font-semibold text-[#3eb489] bg-[#3eb489]/10 rounded-xl">
                            Your pick ✓
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
