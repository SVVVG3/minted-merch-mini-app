'use client';

/**
 * ClaimCreatorEarnings
 * Shows a branded "Claim Creator Earnings" button on the Design Studio product-picker page
 * whenever the authenticated user (a Merch Mogul) has pending royalties to claim.
 *
 * Uses the same Thirdweb airdropERC20WithSignature flow as Minted Merch Missions payouts.
 */

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

const AIRDROP_ABI = [
  {
    name: 'airdropERC20WithSignature',
    type: 'function',
    inputs: [
      {
        name: 'req',
        type: 'tuple',
        components: [
          { name: 'uid',                  type: 'bytes32' },
          { name: 'tokenAddress',          type: 'address' },
          { name: 'expirationTimestamp',   type: 'uint256' },
          {
            name: 'contents',
            type: 'tuple[]',
            components: [
              { name: 'recipient', type: 'address' },
              { name: 'amount',    type: 'uint256' },
            ],
          },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
];

export function ClaimCreatorEarnings({ getSessionToken }) {
  const [stats,        setStats]        = useState(null);   // { totalPending, pendingCount }
  const [loading,      setLoading]      = useState(true);
  const [claiming,     setClaiming]     = useState(false);
  const [claimError,   setClaimError]   = useState(null);
  const [claimSuccess, setClaimSuccess] = useState(false);
  // Store royaltyIds for claim-complete
  const [pendingIds,   setPendingIds]   = useState([]);

  const { writeContract, data: txHash, error: writeError, isPending: isTxPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // ── Fetch pending royalties on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getSessionToken?.();
      if (!token) { setLoading(false); return; }
      try {
        const res  = await fetch('/api/creator/royalties', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          setStats(data.stats);
        }
      } catch { /* non-critical */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getSessionToken]);

  // ── After tx confirmed, mark complete server-side ───────────────────────────
  useEffect(() => {
    if (!isConfirmed || !txHash || !pendingIds.length) return;
    async function finish() {
      try {
        const token = getSessionToken?.();
        await fetch('/api/creator/royalties/claim-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ royaltyIds: pendingIds, transactionHash: txHash }),
        });
        setClaimSuccess(true);
        setStats(prev => prev ? { ...prev, totalPending: 0, pendingCount: 0 } : prev);
      } catch (err) {
        console.error('claim-complete failed:', err);
      } finally {
        setClaiming(false);
      }
    }
    finish();
  }, [isConfirmed, txHash, pendingIds, getSessionToken]);

  // ── Handle writeContract errors ─────────────────────────────────────────────
  useEffect(() => {
    if (!writeError) return;
    const msg = writeError.message?.includes('User rejected')
      ? 'Transaction rejected.'
      : writeError.message || 'Transaction failed.';
    setClaimError(msg);
    setClaiming(false);
  }, [writeError]);

  // ── Kick off claim ───────────────────────────────────────────────────────────
  const handleClaim = async () => {
    setClaimError(null);
    setClaiming(true);
    try {
      const token = getSessionToken?.();
      if (!token) throw new Error('Please sign in first.');

      const res  = await fetch('/api/creator/royalties/claim-data', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to prepare claim.');

      // Stash IDs so claim-complete can mark them
      setPendingIds(data.data.royaltyIds);

      const { req, signature, contractAddress } = data.data;

      // Convert string values back to BigInt for the contract
      const reqWithBigInt = {
        uid:                 req.uid,
        tokenAddress:        req.tokenAddress,
        expirationTimestamp: BigInt(req.expirationTimestamp),
        contents:            req.contents.map(c => ({
          recipient: c.recipient,
          amount:    BigInt(c.amount),
        })),
      };

      writeContract({
        address:      contractAddress,
        abi:          AIRDROP_ABI,
        functionName: 'airdropERC20WithSignature',
        args:         [reqWithBigInt, signature],
      });
    } catch (err) {
      setClaimError(err.message || 'Something went wrong.');
      setClaiming(false);
    }
  };

  // ── Don't render if loading, no pending, or already successfully claimed ───
  if (loading) return null;
  if (!stats || stats.pendingCount === 0) {
    if (!claimSuccess) return null;
  }

  const isBusy = claiming || isTxPending || isConfirming;

  return (
    <div className="w-full max-w-sm mb-4">
      {claimSuccess ? (
        <div className="bg-green-50 border border-[#3eb489] rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="text-sm font-semibold text-[#3eb489]">Creator Earnings Claimed!</p>
            <p className="text-xs text-gray-500">Tokens are on their way to your wallet.</p>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={handleClaim}
            disabled={isBusy}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3eb489] hover:bg-[#35a07a] disabled:opacity-60 text-white font-bold rounded-2xl transition-colors shadow-md text-base"
          >
            {isBusy ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                {isConfirming ? 'Confirming…' : 'Claiming…'}
              </>
            ) : (
              <>
                💎 Claim Creator Earnings
                {stats?.totalPending > 0 && (
                  <span className="ml-1 text-sm font-normal opacity-90">
                    ({(stats.totalPending).toLocaleString()} $mintedmerch)
                  </span>
                )}
              </>
            )}
          </button>
          {claimError && (
            <p className="text-red-500 text-xs mt-2 text-center">{claimError}</p>
          )}
        </>
      )}
    </div>
  );
}
