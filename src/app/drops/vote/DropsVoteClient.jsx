'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFarcaster } from '@/lib/useFarcaster';
import { getSoleLeaderSubmissionId } from '@/lib/dropHelpers';
import { DropVoteControls } from '@/components/DropVoteControls';

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
  if (ms <= 0) return 'Ended';
  const totalHours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${totalHours}h ${mins}m left`;
}

function voteTierLabel(tier, weight) {
  if (tier === 'whale') return `🐋 ${weight} votes (Whale)`;
  if (tier === 'mogul') return `⭐ ${weight} votes (Mogul)`;
  return `${weight} vote`;
}

export default function DropsVoteClient() {
  const { user, getSessionToken } = useFarcaster();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stakedBalance, setStakedBalance] = useState(0);
  const [voteWeight, setVoteWeight] = useState(1);
  const [voteTier, setVoteTier] = useState('standard');
  const [drop, setDrop] = useState(null);
  const [entries, setEntries] = useState([]);
  const [viewer, setViewer] = useState({});
  const [votingId, setVotingId] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const viewerFid = user?.fid ? String(user.fid) : null;

  const applyVoteResponse = (data) => {
    setDrop(data.drop);
    setEntries(data.entries || data.finalists || []);
    setViewer({
      userVotes: data.userVotes || [],
      votesUsed: data.votesUsed || 0,
      votesRemaining: data.votesRemaining ?? Math.max(0, (data.voteWeight || 1) - (data.votesUsed || 0)),
      voteWeight: data.voteWeight || 1,
      voteTier: data.voteTier || 'standard',
      fid: user?.fid || null,
    });
  };

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

      if (!res.ok) throw new Error(data.error || 'Failed to load voting data');

      applyVoteResponse(data);
      setVoteWeight(data.voteWeight || 1);
      setVoteTier(data.voteTier || 'standard');
      setStakedBalance(data.stakedBalance || 0);
      setCountdown(data.drop?.votingEndsAt ? formatCountdown(data.drop.votingEndsAt) : null);
    } catch (err) {
      setError(err.message || 'Failed to load voting data');
    } finally {
      setLoading(false);
    }
  }, [getSessionToken, user?.fid]);

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

  const handleVote = async (submissionId, { points, addPoints } = {}) => {
    const token = getSessionToken();
    if (!token) return;

    setVotingId(submissionId);
    setError('');
    try {
      const body = { submissionId };
      if (typeof points === 'number') body.points = points;
      if (typeof addPoints === 'number') body.addPoints = addPoints;

      const res = await fetch('/api/drops/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to vote');

      applyVoteResponse(data);
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

  const leaderId = getSoleLeaderSubmissionId(entries);
  const votesUsed = viewer.votesUsed || 0;
  const votesRemaining = viewer.votesRemaining ?? Math.max(0, voteWeight - votesUsed);
  const canSplitVotes = voteWeight > 1;

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
            <h2 className="text-lg font-bold text-gray-900 mb-2">No Active Drop</h2>
            <p className="text-sm text-gray-500">
              There isn&apos;t an open Limited Drop right now. Check back soon!
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Limited Drop</h2>
              <p className="text-sm text-gray-500 mt-1">
                {canSplitVotes
                  ? 'Split your voting points across as many designs as you like.'
                  : 'Vote for your favorite — you can\'t vote on your own design.'}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                  {voteTierLabel(voteTier, voteWeight)}
                </span>
                {countdown && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                    ⏱ {countdown}
                  </span>
                )}
              </div>
              {stakedBalance > 0 && voteTier === 'standard' && (
                <p className="text-xs text-gray-400 mt-2">
                  Stake 50M+ for 5× votes · 200M+ for 10×
                </p>
              )}
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                {error}
              </div>
            )}

            {votesUsed > 0 && (
              <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl font-medium">
                {canSplitVotes
                  ? `${votesUsed} of ${voteWeight} points allocated${votesRemaining > 0 ? ` · ${votesRemaining} remaining` : ' · all points allocated'}`
                  : `✅ You voted (${votesUsed} vote${votesUsed === 1 ? '' : 's'} counted)`}
              </div>
            )}

            <div className="space-y-4">
              {entries.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No submissions yet.</p>
              ) : (
                entries.map((entry) => {
                  const votesOnEntry = (viewer.userVotes || []).find((v) => v.submissionId === entry.id)?.voteWeight || 0;
                  const isVoted = votesOnEntry > 0;
                  const isLeading = leaderId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`bg-white rounded-2xl overflow-hidden shadow-sm border-2 ${
                        isVoted ? 'border-[#3eb489]' : 'border-gray-100'
                      }`}
                    >
                      <div className="relative aspect-square bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={entry.mockupUrl} alt="Submission" className="w-full h-full object-contain" />
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
                              {entry.productType}{entry.colorName ? ` · ${entry.colorName}` : ''}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <CreatorAvatar username={entry.username} fid={entry.fid} pfpUrl={entry.pfpUrl} />
                              <p className="text-xs text-gray-500">@{entry.username || entry.fid}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#3eb489]">{entry.voteCount}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">votes</p>
                          </div>
                        </div>
                        <DropVoteControls
                          entry={entry}
                          viewer={{ ...viewer, voteWeight, voteTier, fid: user?.fid || null }}
                          viewerFid={viewerFid}
                          votingId={votingId}
                          onVote={handleVote}
                          onSetPoints={(submissionId, points) => handleVote(submissionId, { points })}
                          isInFarcaster
                        />
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
