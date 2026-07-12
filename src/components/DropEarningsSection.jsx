'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { triggerHaptic } from '@/lib/haptics';

const AIRDROP_ABI = [
  {
    name: 'airdropERC20WithSignature',
    type: 'function',
    inputs: [
      {
        name: 'req',
        type: 'tuple',
        components: [
          { name: 'uid', type: 'bytes32' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'expirationTimestamp', type: 'uint256' },
          {
            name: 'contents',
            type: 'tuple[]',
            components: [
              { name: 'recipient', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
];

function formatTokens(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

export function DropEarningsSection({ getSessionToken, isInFarcaster }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [claimError, setClaimError] = useState(null);
  const [claimSuccess, setClaimSuccess] = useState(null);

  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const loadPayouts = useCallback(async () => {
    const token = getSessionToken?.();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/drops/creator-payouts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPayouts(data.payouts || []);
      }
    } catch (err) {
      console.error('Drop earnings load error:', err);
    } finally {
      setLoading(false);
    }
  }, [getSessionToken]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const markComplete = useCallback(async (payoutId, txHash) => {
    const token = getSessionToken?.();
    if (!token) return;
    try {
      const res = await fetch(`/api/drops/creator-payouts/${payoutId}/claim-complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionHash: txHash }),
      });
      const result = await res.json();
      if (result.success) {
        triggerHaptic('success', isInFarcaster);
        setClaimSuccess(payoutId);
        setTimeout(() => {
          setClaimSuccess(null);
          loadPayouts();
        }, 2000);
      }
    } catch (err) {
      console.error('Drop claim complete error:', err);
    } finally {
      setClaiming(null);
    }
  }, [getSessionToken, isInFarcaster, loadPayouts]);

  useEffect(() => {
    if (isConfirmed && hash && claiming) {
      markComplete(claiming, hash);
    }
  }, [isConfirmed, hash, claiming, markComplete]);

  useEffect(() => {
    if (writeError && claiming) {
      if (writeError.message?.includes('AirdropRequestAlreadyProcessed')) {
        markComplete(claiming, 'on-chain-uid-consumed-db-sync');
        return;
      }
      setClaimError(writeError.message || 'Transaction failed');
      setClaiming(null);
    }
  }, [writeError, claiming, markComplete]);

  const handleClaim = async (payoutId) => {
    const token = getSessionToken?.();
    if (!token) return;
    setClaiming(payoutId);
    setClaimError(null);
    triggerHaptic('light', isInFarcaster);

    try {
      const res = await fetch(`/api/drops/creator-payouts/${payoutId}/claim-data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || result.message || 'Claim failed');

      const claimData = result.data;
      const reqWithBigInt = {
        uid: claimData.req.uid,
        tokenAddress: claimData.req.tokenAddress,
        expirationTimestamp: BigInt(claimData.req.expirationTimestamp),
        contents: claimData.req.contents.map((c) => ({
          recipient: c.recipient,
          amount: BigInt(c.amount),
        })),
      };

      writeContract({
        address: claimData.contractAddress,
        abi: AIRDROP_ABI,
        functionName: 'airdropERC20WithSignature',
        args: [reqWithBigInt, claimData.signature],
        chainId: claimData.chainId || 8453,
      });
    } catch (err) {
      setClaimError(err.message || 'Failed to claim');
      setClaiming(null);
    }
  };

  if (loading) return null;
  if (payouts.length === 0) return null;

  const claimableTotal = payouts
    .filter((p) => p.status === 'claimable')
    .reduce((sum, p) => sum + (p.amountTokens || 0), 0);

  return (
    <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-700/50 rounded-xl p-5 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-emerald-800/50 rounded-full flex items-center justify-center">
            🏆
          </div>
          <div>
            <h4 className="font-bold text-emerald-400">Drop Earnings</h4>
            <p className="text-xs text-emerald-500">5M $mintedmerch per unit sold on your winning drop</p>
          </div>
        </div>
        {claimableTotal > 0 && (
          <div className="text-right">
            <div className="text-lg font-bold text-emerald-400">{formatTokens(claimableTotal)}</div>
            <div className="text-xs text-emerald-500">claimable $mintedmerch</div>
          </div>
        )}
      </div>

      {claimError && (
        <p className="text-red-400 text-xs mb-3">{claimError}</p>
      )}

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {payouts.map((payout) => (
          <div
            key={payout.id}
            className="bg-gray-800/50 rounded-lg p-3 border border-emerald-700/30 flex justify-between items-center gap-3"
          >
            <div className="min-w-0">
              <p className="font-semibold text-emerald-300 text-sm truncate">
                {payout.weekLabel || 'Limited Drop'}
              </p>
              <p className="text-xs text-emerald-500">
                {payout.units_sold} sold × 5M = {formatTokens(payout.amountTokens)} $mintedmerch
              </p>
            </div>
            <div className="flex-shrink-0">
              {payout.status === 'claimable' ? (
                <button
                  onClick={() => handleClaim(payout.id)}
                  disabled={claiming === payout.id || isPending}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
                >
                  {claiming === payout.id ? 'Claiming…' : claimSuccess === payout.id ? 'Claimed!' : 'Claim'}
                </button>
              ) : payout.status === 'completed' ? (
                <span className="text-xs text-green-400 font-medium">✅ Claimed</span>
              ) : (
                <span className="text-xs text-yellow-400 font-medium">⏳ Pending</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
