'use client';

import { DropEntryShareButton } from './DropEntryShareButton';

function pointsLabel(count) {
  return `${count} pt${count === 1 ? '' : 's'}`;
}

export function DropVoteControls({
  entry,
  viewer,
  viewerFid,
  votingId,
  onVote,
  onSetPoints,
  isInFarcaster,
}) {
  const entryId = entry.id;
  const isOwn = viewerFid && String(entry.fid) === viewerFid;
  const userVotes = viewer.userVotes || [];
  const votesOnEntry = userVotes.find((v) => v.submissionId === entryId)?.voteWeight || 0;
  const voteWeight = viewer.voteWeight || 1;
  const votesRemaining = viewer.votesRemaining ?? Math.max(0, voteWeight - (viewer.votesUsed || 0));
  const canSplit = voteWeight > 1;
  const isBusy = votingId === entryId;

  if (isOwn) {
    return (
      <p className="text-xs text-center text-gray-400 py-2 bg-gray-50 rounded-lg">
        Your design — others vote for you
      </p>
    );
  }

  if (!viewer.fid) return null;

  if (!canSplit) {
    const isVoted = votesOnEntry > 0;
    const canVote = !isVoted;

    if (canVote) {
      return (
        <button
          type="button"
          onClick={() => onVote(entryId, { points: 1 })}
          disabled={!!votingId}
          className="w-full py-2.5 bg-[#3eb489] hover:bg-[#359970] disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
        >
          {isBusy ? 'Submitting…' : 'Vote (1 pt)'}
        </button>
      );
    }

    return (
      <>
        <p className="text-center text-xs font-semibold text-[#3eb489]">Your pick ✓</p>
        <DropEntryShareButton entry={entry} shareType="vote" isInFarcaster={isInFarcaster} />
      </>
    );
  }

  return (
    <div className="space-y-2">
      {votesOnEntry > 0 && (
        <p className="text-center text-xs font-semibold text-[#3eb489]">
          Your votes: {pointsLabel(votesOnEntry)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {votesRemaining > 0 && (
          <button
            type="button"
            onClick={() => onVote(entryId, { addPoints: 1 })}
            disabled={!!votingId}
            className="flex-1 min-w-[88px] py-2 bg-[#3eb489] hover:bg-[#359970] disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
          >
            {isBusy ? 'Saving…' : '+1 pt'}
          </button>
        )}
        {votesRemaining > 1 && (
          <button
            type="button"
            onClick={() => onVote(entryId, { addPoints: votesRemaining })}
            disabled={!!votingId}
            className="flex-1 min-w-[88px] py-2 bg-[#3eb489]/90 hover:bg-[#359970] disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
          >
            {isBusy ? 'Saving…' : `+${votesRemaining} pts`}
          </button>
        )}
        {votesOnEntry > 0 && (
          <button
            type="button"
            onClick={() => onSetPoints(entryId, 0)}
            disabled={!!votingId}
            className="py-2 px-3 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-600 font-medium rounded-xl text-sm"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={`vote-points-${entryId}`} className="text-xs text-gray-500 whitespace-nowrap">
          Set total:
        </label>
        <select
          id={`vote-points-${entryId}`}
          value={votesOnEntry}
          disabled={!!votingId}
          onChange={(e) => onSetPoints(entryId, Number(e.target.value))}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          {Array.from({ length: voteWeight + 1 }, (_, value) => value).map((value) => {
            const otherUsed = (viewer.votesUsed || 0) - votesOnEntry;
            if (value + otherUsed > voteWeight) return null;
            return (
              <option key={value} value={value}>
                {value === 0 ? '0 pts' : pointsLabel(value)}
              </option>
            );
          })}
        </select>
      </div>

      {votesOnEntry > 0 && (
        <DropEntryShareButton entry={entry} shareType="vote" isInFarcaster={isInFarcaster} />
      )}
    </div>
  );
}
