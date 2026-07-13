'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFarcaster } from '@/lib/useFarcaster';
import { useCart } from '@/lib/CartContext';
import { getProductConfig } from '@/lib/designStudioConfig';
import { getSoleLeaderSubmissionId } from '@/lib/dropHelpers';
import { openUrl } from '@/lib/clientAwareUrls';
import { DesignStudioBanner } from './DesignStudioBanner';
import { DropGuideCard, buildDropGuideContent } from './DropGuideCard';
import { DropSubmitDesignTray } from './DropSubmitDesignTray';
import { ShareDropdown } from './ShareDropdown';

function getSubmitVoteHeading(viewer = {}) {
  if (!viewer.fid) return 'Submit & Vote';
  const hasSubmission = !!viewer.userSubmission;
  const hasVoted = !!viewer.hasVoted;
  if (hasSubmission && hasVoted) return "You're All Set";
  if (hasSubmission) return 'Cast Your Vote';
  if (hasVoted) return 'Submit a Design';
  return 'Submit & Vote';
}

function getDropEntryShareContent(entry, shareType) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const mockupId = entry?.mockupId || entry?.mockup_id;
  const url = mockupId
    ? `${origin}/design/${mockupId}?dropShare=1`
    : `${origin}/?collection=limited-drops`;

  if (shareType === 'submission') {
    return {
      customUrl: url,
      customText: 'I just submitted my design for the upcoming @mintedmerch Limited Drop!\n\nSubmit your own & cast your vote below ↓',
    };
  }

  const creator = entry?.username ? `@${entry.username}` : '@mintedmerch';
  return {
    customUrl: url,
    customText: `I voted for ${creator}'s design to be the next @mintedmerch Limited Drop!\n\nVote & submit your design in the mini app ↓`,
  };
}

function DropEntryShareButton({ entry, shareType, isInFarcaster, className = '' }) {
  const content = getDropEntryShareContent(entry, shareType);
  return (
    <div className={`w-full [&>div]:w-full [&_button]:w-full [&_button]:justify-center ${className}`}>
      <ShareDropdown
        type="custom"
        customUrl={content.customUrl}
        customText={content.customText}
        isInFarcaster={isInFarcaster}
        buttonStyle="text"
        buttonText={shareType === 'submission' ? 'Share My Entry' : 'Share My Vote'}
        dropUp
      />
    </div>
  );
}

function VoteTierBadge({ tier, weight }) {
  const pill = (
    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
      Voting Power: {weight}
    </span>
  );

  if (tier === 'whale') {
    return (
      <span className="inline-flex items-center gap-2">
        {pill}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/GoldVerifiedMerchMogulBadge.png"
          alt="Whale"
          className="h-5 w-auto object-contain"
          title="200M+ $mintedmerch staked"
        />
      </span>
    );
  }
  if (tier === 'mogul') {
    return (
      <span className="inline-flex items-center gap-2">
        {pill}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/VerifiedMerchMogulBadge.png"
          alt="Merch Mogul"
          className="h-5 w-auto object-contain"
          title="50M+ $mintedmerch staked"
        />
      </span>
    );
  }
  return pill;
}

function CreatorAvatar({ username, fid, pfpUrl, size = 'sm' }) {
  const dim = size === 'sm' ? 'w-6 h-6' : size === 'xs' ? 'w-5 h-5' : 'w-8 h-8';
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

function CreatorProfileLink({ username, fid, pfpUrl, size = 'sm' }) {
  const label = username || (fid ? String(fid) : 'creator');
  const canOpen = !!(username || fid);

  return (
    <button
      type="button"
      onClick={() => canOpen && openCreatorProfile({ username, fid })}
      disabled={!canOpen}
      className={`flex items-center gap-1.5 min-w-0 transition-opacity ${
        canOpen ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
      }`}
    >
      <CreatorAvatar username={username} fid={fid} pfpUrl={pfpUrl} size={size} />
      <p className="text-xs text-gray-500 truncate">@{label}</p>
    </button>
  );
}

function ViewDesignLink({ mockupId }) {
  if (!mockupId) return null;
  return (
    <Link
      href={`/design/${mockupId}`}
      className="text-xs text-[#3eb489] font-semibold hover:underline flex-shrink-0 whitespace-nowrap"
    >
      View design →
    </Link>
  );
}

function formatCustomProductLabel(productType) {
  if (!productType) return 'Custom Design';
  const label = productType.charAt(0).toUpperCase() + productType.slice(1);
  return `Custom ${label}`;
}

function EntryProductLine({ productType, mockupId, className = '' }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <p className="text-sm font-semibold text-gray-900 truncate">
        {formatCustomProductLabel(productType)}
      </p>
      <ViewDesignLink mockupId={mockupId} />
    </div>
  );
}

function YourEntryTile({ submission, isInFarcaster }) {
  return (
    <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/50 w-full">
      <div className="p-3 flex gap-3 items-center">
        {submission.mockupUrl && (
          <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={submission.mockupUrl} alt="" className="w-full h-full object-contain" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800">Your entry · {submission.voteCount || 0} votes</p>
          <EntryProductLine
            productType={submission.productType}
            mockupId={submission.mockupId}
          />
        </div>
      </div>
      <div className="px-3 pb-3">
        <DropEntryShareButton
          entry={submission}
          shareType="submission"
          isInFarcaster={isInFarcaster}
        />
      </div>
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

async function openCreatorProfile({ username, fid }) {
  const profileUrl = username
    ? `https://farcaster.xyz/${username}`
    : fid
      ? `https://warpcast.com/~/profiles/${fid}`
      : null;
  if (!profileUrl) return;
  await openUrl(profileUrl);
}

function DesignerCredit({ winner, compact = false }) {
  if (!winner) return null;
  const label = winner.username || (winner.fid ? String(winner.fid) : 'creator');
  const canOpen = !!(winner.username || winner.fid);

  return (
    <button
      type="button"
      onClick={() => canOpen && openCreatorProfile(winner)}
      disabled={!canOpen}
      className={`flex items-center justify-center gap-1.5 mx-auto transition-opacity ${
        canOpen ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
      } ${compact ? 'mb-2' : 'mb-3'}`}
    >
      <CreatorAvatar
        username={winner.username}
        fid={winner.fid}
        pfpUrl={winner.pfpUrl}
        size={compact ? 'xs' : 'sm'}
      />
      <p className={`text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>
        Designed by{' '}
        <span className="text-[#3eb489] font-medium">
          @{label}
        </span>
      </p>
    </button>
  );
}

/** Voting countdown during active phase; 48h sale window countdown when live. */
function getCountdownEndsAt(phase, drop) {
  if (!drop) return null;
  if (phase === 'live' || phase === 'sold_out') {
    return drop.dropEndsAt || null;
  }
  if (phase === 'active') {
    return drop.votingEndsAt || null;
  }
  return null;
}

export function DropCollectionView({ products, onDesignStudioPlacementChange }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { getSessionToken, user, isInFarcaster, sessionToken } = useFarcaster();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [shopifyVariants, setShopifyVariants] = useState([]);
  const [selectedSize, setSelectedSize] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [votingId, setVotingId] = useState(null);
  const [voteError, setVoteError] = useState('');
  const [submitTrayOpen, setSubmitTrayOpen] = useState(false);
  const votingSectionRef = useRef(null);

  const loadStatus = useCallback(async () => {
    const token = getSessionToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const res = await fetch('/api/drops/status', { headers });
      const data = await res.json();
      setStatus(data);
      const endsAt = getCountdownEndsAt(data.phase, data.drop);
      setCountdown(endsAt ? formatCountdown(endsAt) : null);
    } catch {
      setStatus({ phase: 'none' });
    } finally {
      setLoading(false);
    }
  }, [getSessionToken]);

  useEffect(() => {
    // Wait for session token when Farcaster user is known — avoids a false signed-out state
    if (user?.fid && !sessionToken) return;
    loadStatus();
  }, [loadStatus, user?.fid, sessionToken]);

  useEffect(() => {
    const endsAt = getCountdownEndsAt(status?.phase, status?.drop);
    if (!endsAt) return;
    const tick = () => setCountdown(formatCountdown(endsAt));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [status?.phase, status?.drop?.votingEndsAt, status?.drop?.dropEndsAt]);

  const resolveDropProduct = useCallback((dropData) => {
    if (!products?.length) return null;
    if (dropData?.shopifyProductId) {
      return products.find(p => p.id === dropData.shopifyProductId) || products[0];
    }
    return products[0];
  }, [products]);

  const openOrderSheet = useCallback(async (dropData, winnerData) => {
    const productConfig = winnerData?.productType ? getProductConfig(winnerData.productType) : null;
    const dropProduct = resolveDropProduct(dropData);
    const shopifyProductId = productConfig?.shopifyProductId
      || dropData?.shopifyProductId
      || dropProduct?.id;
    if (!shopifyProductId) {
      setOrderError('Product not available yet.');
      return;
    }

    setOrderOpen(true);
    setOrderError('');
    setSelectedSize('');
    setShopifyVariants([]);

    try {
      const colorParam = winnerData?.colorName
        ? `&color=${encodeURIComponent(winnerData.colorName)}`
        : '';
      const res = await fetch(
        `/api/design-studio/shopify-variants?productId=${encodeURIComponent(shopifyProductId)}${colorParam}`
      );
      const data = await res.json();
      if (data.variants?.length) {
        setShopifyVariants(data.variants);
        setSelectedSize(data.variants[0]?.title || '');
      } else {
        setOrderError('Could not load sizes. Please try again.');
      }
    } catch (err) {
      setOrderError(`Could not load sizes: ${err.message}`);
    }
  }, [resolveDropProduct]);

  const handleOrderConfirm = useCallback(async (dropData, winnerData) => {
    if (!selectedSize) {
      setOrderError('Please select a size.');
      return;
    }

    const dropProduct = resolveDropProduct(dropData);
    if (!dropProduct) {
      setOrderError('Product not available yet.');
      return;
    }

    const matchedVariant = shopifyVariants.find(v => v.title === selectedSize) || shopifyVariants[0];
    if (!matchedVariant) {
      setOrderError('Please select a size.');
      return;
    }

    setOrderLoading(true);
    setOrderError('');
    try {
      const productConfig = winnerData?.productType ? getProductConfig(winnerData.productType) : null;
      const cartVariant = {
        id: matchedVariant.id,
        title: matchedVariant.title,
        price: { amount: String(matchedVariant.price), currencyCode: 'USD' },
        availableForSale: matchedVariant.availableForSale !== false,
        image: null,
      };

      const cartProduct = productConfig
        ? {
            id: productConfig.shopifyProductId,
            title: `Limited Drop — ${productConfig.label}`,
            handle: `design-studio-custom-${productConfig.id}`,
            images: { edges: [] },
          }
        : dropProduct;

      if (!cartProduct) {
        setOrderError('Product not available yet.');
        return;
      }

      addItem(cartProduct, cartVariant, 1, {
        customImageUrl: winnerData?.mockupUrl || null,
        customMeta: {
          dropId: dropData?.id || null,
          designRequestId: dropData?.designRequestId || null,
          productType: winnerData?.productType || null,
          colorName: winnerData?.colorName || null,
          size: selectedSize,
        },
      });

      setOrderOpen(false);
      router.push('/?openCart=1&collection=limited-drops');
    } catch (err) {
      setOrderError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setOrderLoading(false);
    }
  }, [addItem, resolveDropProduct, router, selectedSize, shopifyVariants]);

  const handleVote = async (submissionId) => {
    const token = getSessionToken();
    if (!token) {
      setVoteError('Please sign in with Farcaster to vote.');
      return;
    }
    setVotingId(submissionId);
    setVoteError('');
    try {
      const res = await fetch('/api/drops/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to vote');
      setStatus(prev => ({
        ...prev,
        entries: data.entries || data.finalists,
        finalists: data.finalists || data.entries,
        viewer: {
          ...prev?.viewer,
          hasVoted: true,
          userVoteSubmissionId: data.userVote?.submissionId,
        },
      }));
    } catch (err) {
      setVoteError(err.message || 'Failed to vote');
    } finally {
      setVotingId(null);
    }
  };

  const phase = status?.phase || 'none';
  const drop = status?.drop;
  const viewer = status?.viewer || {};
  const entries = status?.entries || status?.finalists || [];
  const winner = status?.winner;

  const liveUnitsLeft = phase === 'live' && drop
    ? Math.max(0, (drop.maxUnits || 37) - (drop.unitsSold || 0))
    : 0;
  const liveSaleEndsAt = drop?.dropEndsAt;
  const liveSaleWindowOpen = !liveSaleEndsAt || new Date(liveSaleEndsAt).getTime() > Date.now();
  const liveDropProduct = phase === 'live' ? resolveDropProduct(drop) : null;
  const liveProductConfig = winner?.productType ? getProductConfig(winner.productType) : null;
  const liveCanOrder = phase === 'live' && liveUnitsLeft > 0 && liveSaleWindowOpen
    && !!(liveProductConfig?.shopifyProductId || drop?.shopifyProductId || liveDropProduct);
  const isActiveVotePhase = phase === 'active' || phase === 'submissions' || phase === 'voting';
  const showDesignStudioInModule = liveCanOrder
    || phase === 'sold_out'
    || phase === 'none'
    || (isActiveVotePhase && viewer.fid);

  useEffect(() => {
    if (loading) return;
    onDesignStudioPlacementChange?.(showDesignStudioInModule);
    return () => onDesignStudioPlacementChange?.(false);
  }, [showDesignStudioInModule, loading, onDesignStudioPlacementChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]" />
      </div>
    );
  }

  if (phase === 'active' || phase === 'submissions' || phase === 'voting') {
    const userSubmission = viewer.userSubmission;
    const leaderId = getSoleLeaderSubmissionId(entries);
    const viewerFid = viewer.fid ? String(viewer.fid) : null;

    return (
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/MintedMerchSpinnerLogo.png"
            alt="Minted Merch"
            className="h-[3.9rem] mx-auto mb-1 object-contain"
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3eb489] mb-1">Limited Drop Submissions — Live</p>
          <h2 className="text-xl font-bold text-gray-900">{getSubmitVoteHeading(viewer)}</h2>
          <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
            {countdown && (
              <span className="px-3 py-1 bg-[#3eb489]/10 text-[#3eb489] text-xs font-semibold rounded-full">
                ⏱ {countdown}
              </span>
            )}
            {viewer.fid && (
              <VoteTierBadge tier={viewer.voteTier} weight={viewer.voteWeight} />
            )}
          </div>
        </div>

        {userSubmission && (
          <YourEntryTile submission={userSubmission} isInFarcaster={isInFarcaster} />
        )}

        {viewer.fid && (
          <div className="space-y-4">
            {!userSubmission && (
              <button
                type="button"
                onClick={() => setSubmitTrayOpen(true)}
                className="w-full py-3.5 bg-[#3eb489] hover:bg-[#359970] text-white font-semibold rounded-2xl text-sm transition-colors"
              >
                🎨 Submit a Design
              </button>
            )}
            <DesignStudioBanner compact fullWidth />
            {!userSubmission && (
              <p className="text-xs text-gray-400 text-center leading-snug">
                One submission per person per drop
              </p>
            )}
          </div>
        )}

        {viewer.fid && !viewer.hasVoted && (
          <button
            type="button"
            onClick={() => votingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-full py-3 bg-[#3eb489] hover:bg-[#359970] text-white font-semibold rounded-2xl text-sm transition-colors"
          >
            ↓ Vote Now ↓
          </button>
        )}

        {viewer.fid && viewer.hasVoted && (
          <button
            type="button"
            onClick={() => votingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-full py-3 bg-[#3eb489] hover:bg-[#359970] text-white font-semibold rounded-2xl text-sm transition-colors"
          >
            ↓ View Leaderboard ↓
          </button>
        )}

        <DropGuideCard
          {...buildDropGuideContent({
            phase,
            drop,
            viewer,
            countdown,
          })}
        />

        <DropSubmitDesignTray
          open={submitTrayOpen}
          onClose={() => setSubmitTrayOpen(false)}
          onSubmitted={loadStatus}
          onVoteNow={() => {
            setSubmitTrayOpen(false);
            window.setTimeout(() => {
              votingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
          }}
          getSessionToken={getSessionToken}
        />

        <div ref={votingSectionRef} className="space-y-4">
        {voteError && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">{voteError}</div>
        )}

        {viewer.hasVoted && (
          <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-xl text-center">
            ✅ Your vote is in ({viewer.voteWeight} pt{viewer.voteWeight !== 1 ? 's' : ''} counted)
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 text-center">Leaderboard</p>
          {entries.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No submissions yet — be the first!</p>
          ) : (
            entries.map((entry) => {
              const isOwn = viewerFid && String(entry.fid) === viewerFid;
              const isVoted = viewer.userVoteSubmissionId === entry.id;
              const canVote = viewer.fid && !viewer.hasVoted && !isOwn;
              return (
                <div key={entry.id} className={`bg-white rounded-xl border shadow-sm ${
                  isVoted ? 'border-[#3eb489] border-2' : 'border-gray-100'
                }`}>
                  <div className="flex gap-3 p-3">
                    <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.mockupUrl} alt="" className="w-full h-full object-contain" />
                      {leaderId === entry.id && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full">👑</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <EntryProductLine
                        productType={entry.productType}
                        mockupId={entry.mockupId}
                      />
                      <div className="flex items-center mt-0.5">
                        <CreatorProfileLink
                          username={entry.username}
                          fid={entry.fid}
                          pfpUrl={entry.pfpUrl}
                        />
                      </div>
                      <p className="text-lg font-bold text-[#3eb489] mt-1">
                        {entry.voteCount} <span className="text-xs font-normal text-gray-400">votes</span>
                      </p>
                    </div>
                  </div>
                  {(isOwn || canVote || isVoted) && (
                  <div className="px-3 pb-3 space-y-2">
                    {isOwn ? (
                      <p className="text-xs text-center text-gray-400 py-2 bg-gray-50 rounded-lg">Your design — others vote for you</p>
                    ) : canVote ? (
                      <button
                        type="button"
                        onClick={() => handleVote(entry.id)}
                        disabled={!!votingId}
                        className="w-full py-2.5 bg-[#3eb489] hover:bg-[#359970] disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
                      >
                        {votingId === entry.id ? 'Submitting…' : `Vote (${viewer.voteWeight} pt${viewer.voteWeight !== 1 ? 's' : ''})`}
                      </button>
                    ) : isVoted ? (
                      <>
                        <p className="text-center text-xs font-semibold text-[#3eb489]">Your pick ✓</p>
                        <DropEntryShareButton
                          entry={entry}
                          shareType="vote"
                          isInFarcaster={isInFarcaster}
                        />
                      </>
                    ) : null}
                  </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {!viewer.fid && (
          <p className="text-center text-xs text-gray-400">Sign in with Farcaster to submit and vote</p>
        )}
        </div>
      </div>
    );
  }

  if (phase === 'none') {
    return (
      <div className="px-4 py-4 max-w-lg mx-auto">
        <DropGuideCard
          {...buildDropGuideContent({ phase, drop, viewer, countdown })}
        />
      </div>
    );
  }

  if (phase === 'winner_pending') {
    return (
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {winner?.mockupUrl && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={winner.mockupUrl} alt="Winning drop design" className="w-full aspect-square object-contain bg-gray-50" />
            <div className="p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">🏆 Winner Selected</p>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Limited Drop</h2>
              <DesignerCredit winner={winner} />
            </div>
          </div>
        )}
        <DropGuideCard
          {...buildDropGuideContent({ phase, drop, viewer, countdown })}
        />
      </div>
    );
  }

  if (phase === 'live') {
    const unitsLeft = liveUnitsLeft;
    const saleEndsAt = liveSaleEndsAt;
    const saleWindowOpen = liveSaleWindowOpen;
    const dropProduct = liveDropProduct;
    const productConfig = liveProductConfig;
    const displayPrice = dropProduct?.priceRange?.minVariantPrice?.amount;
    const canOrder = liveCanOrder;

    return (
      <div className="px-3 py-2 max-w-lg mx-auto space-y-4">
        {winner?.mockupUrl && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={winner.mockupUrl}
                alt="Winning drop design"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600">Live Now</p>
              <div className="flex items-center justify-center gap-2 mt-0.5 mb-1">
                <h2 className="text-base font-bold text-gray-900">Limited Drop</h2>
                {displayPrice && (
                  <span className="text-base font-bold text-gray-900">
                    ${parseFloat(displayPrice).toFixed(2)}
                  </span>
                )}
              </div>
              <DesignerCredit winner={winner} compact />
              <p className="text-xs text-gray-400 mb-3 leading-snug">
                {unitsLeft} of {drop.maxUnits || 37} left
                {saleEndsAt && saleWindowOpen && countdown && countdown !== 'Ended' && (
                  <span> · Sale ends in {countdown.replace(' left', '')}</span>
                )}
                {winner.productType && (
                  <span className="capitalize"> · {winner.productType}{winner.colorName ? ` · ${winner.colorName}` : ''}</span>
                )}
              </p>
              {canOrder ? (
                <button
                  type="button"
                  onClick={() => openOrderSheet(drop, winner)}
                  className="w-full py-2.5 bg-[#3eb489] hover:bg-[#359970] text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  Order Now
                </button>
              ) : (
                <p className="text-xs text-gray-500">
                  {!saleWindowOpen ? 'Sale window ended (48-hour limit).' : unitsLeft <= 0 ? 'Sold out for this drop.' : 'Product listing coming to shop shortly.'}
                </p>
              )}
            </div>
          </div>
        )}

        <DropGuideCard
          {...buildDropGuideContent({
            phase,
            drop,
            viewer,
            countdown,
            unitsLeft,
            canOrder,
          })}
        />

        {canOrder && <DesignStudioBanner compact fullWidth bottomSpaced />}

        {orderOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => !orderLoading && setOrderOpen(false)} />
            <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-xl">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <h2 className="text-base font-bold text-gray-900 mb-1">Limited Drop</h2>
              <p className="text-sm text-gray-500 mb-4 capitalize">
                {winner?.productType || 'Item'}
                {winner?.colorName ? ` · ${winner.colorName}` : ''}
              </p>

              {shopifyVariants.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3eb489]" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mb-5">
                  {shopifyVariants.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedSize(v.title)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        selectedSize === v.title
                          ? 'bg-[#3eb489] text-white border-[#3eb489]'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {v.title}
                    </button>
                  ))}
                </div>
              )}

              {productConfig?.sizeNote && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  {productConfig.sizeNote}
                </p>
              )}

              {orderError && (
                <p className="text-red-500 text-sm mb-3">{orderError}</p>
              )}

              <button
                type="button"
                onClick={() => handleOrderConfirm(drop, winner)}
                disabled={orderLoading || !selectedSize}
                className="w-full py-3.5 bg-[#3eb489] disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors text-base"
              >
                {orderLoading ? 'Adding to cart…' : (() => {
                  const matched = shopifyVariants.find(v => v.title === selectedSize) || shopifyVariants[0];
                  const price = matched?.price ?? displayPrice;
                  return `Add to Cart · ${price ? `$${parseFloat(price).toFixed(2)}` : '—'}`;
                })()}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'sold_out') {
    const maxUnits = drop?.maxUnits || 37;
    const dropProduct = resolveDropProduct(drop);
    const displayPrice = dropProduct?.priceRange?.minVariantPrice?.amount;

    return (
      <div className="px-3 py-2 max-w-lg mx-auto space-y-4">
        {winner?.mockupUrl && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={winner.mockupUrl}
                alt="Winning drop design"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Sold Out</p>
              <div className="flex items-center justify-center gap-2 mt-0.5 mb-1">
                <h2 className="text-base font-bold text-gray-900">Limited Drop</h2>
                {displayPrice && (
                  <span className="text-base font-bold text-gray-900">
                    ${parseFloat(displayPrice).toFixed(2)}
                  </span>
                )}
              </div>
              <DesignerCredit winner={winner} compact />
              <p className="text-xs text-gray-400 mb-3 leading-snug">
                Sold out · 0 of {maxUnits} left
                {winner.productType && (
                  <span className="capitalize"> · {winner.productType}{winner.colorName ? ` · ${winner.colorName}` : ''}</span>
                )}
              </p>
              <button
                type="button"
                disabled
                className="w-full py-2.5 bg-gray-200 text-gray-500 font-semibold rounded-xl text-sm cursor-not-allowed"
              >
                Sold Out
              </button>
            </div>
          </div>
        )}

        <DropGuideCard
          {...buildDropGuideContent({ phase, drop, viewer, countdown })}
        />

        <DesignStudioBanner compact fullWidth bottomSpaced />
      </div>
    );
  }

  return null;
}
