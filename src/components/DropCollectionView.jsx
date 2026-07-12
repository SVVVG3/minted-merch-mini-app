'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFarcaster } from '@/lib/useFarcaster';
import { useCart } from '@/lib/CartContext';
import { getProductConfig } from '@/lib/designStudioConfig';
import { getSoleLeaderSubmissionId } from '@/lib/dropHelpers';
import { openUrl } from '@/lib/clientAwareUrls';
import { DesignStudioBanner } from './DesignStudioBanner';
import { DropGuideCard, buildDropGuideContent } from './DropGuideCard';

function voteTierLabel(tier, weight) {
  if (tier === 'whale') return `🐋 ${weight} votes`;
  if (tier === 'mogul') return `⭐ ${weight} votes`;
  return `${weight} vote`;
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
  const { getSessionToken, user } = useFarcaster();
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
    loadStatus();
  }, [loadStatus, user?.fid]);

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

  useEffect(() => {
    if (loading) return;
    onDesignStudioPlacementChange?.(liveCanOrder || phase === 'none');
    return () => onDesignStudioPlacementChange?.(false);
  }, [liveCanOrder, phase, loading, onDesignStudioPlacementChange]);

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
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3eb489] mb-1">Limited Drop — Live</p>
          <h2 className="text-xl font-bold text-gray-900">Submit & Vote</h2>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {countdown && (
              <span className="px-3 py-1 bg-[#3eb489]/10 text-[#3eb489] text-xs font-semibold rounded-full">
                ⏱ {countdown}
              </span>
            )}
            {viewer.fid && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                {voteTierLabel(viewer.voteTier, viewer.voteWeight)}
              </span>
            )}
          </div>
        </div>

        <DropGuideCard
          {...buildDropGuideContent({
            phase,
            drop,
            viewer,
            countdown,
          })}
        />

        {userSubmission && (
          <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex gap-3 items-center">
            {userSubmission.mockupUrl && (
              <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={userSubmission.mockupUrl} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">Your entry · {userSubmission.voteCount || 0} votes</p>
              <p className="text-sm text-gray-700 capitalize truncate">
                {userSubmission.productType}{userSubmission.colorName ? ` · ${userSubmission.colorName}` : ''}
              </p>
              {userSubmission.mockupId && (
                <Link href={`/design/${userSubmission.mockupId}`} className="text-xs text-[#3eb489] font-semibold hover:underline">
                  View design →
                </Link>
              )}
            </div>
          </div>
        )}

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
                <div key={entry.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
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
                      <p className="text-sm font-semibold text-gray-900 capitalize truncate">
                        {entry.productType}{entry.colorName ? ` · ${entry.colorName}` : ''}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CreatorAvatar username={entry.username} fid={entry.fid} pfpUrl={entry.pfpUrl} />
                        <p className="text-xs text-gray-500 truncate">@{entry.username || entry.fid || 'creator'}</p>
                      </div>
                      <p className="text-lg font-bold text-[#3eb489] mt-1">
                        {entry.voteCount} <span className="text-xs font-normal text-gray-400">votes</span>
                      </p>
                    </div>
                  </div>
                  {isOwn ? (
                    <div className="px-3 pb-3">
                      <p className="text-xs text-center text-gray-400 py-2 bg-gray-50 rounded-lg">Your design — others vote for you</p>
                    </div>
                  ) : canVote ? (
                    <div className="px-3 pb-3">
                      <button
                        type="button"
                        onClick={() => handleVote(entry.id)}
                        disabled={!!votingId}
                        className="w-full py-2.5 bg-[#3eb489] hover:bg-[#359970] disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
                      >
                        {votingId === entry.id ? 'Submitting…' : `Vote (${viewer.voteWeight} pt${viewer.voteWeight !== 1 ? 's' : ''})`}
                      </button>
                    </div>
                  ) : isVoted ? (
                    <div className="px-3 pb-3 text-center text-xs font-semibold text-[#3eb489]">Your pick ✓</div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {!viewer.fid && (
          <p className="text-center text-xs text-gray-400">Sign in with Farcaster to submit and vote</p>
        )}
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
                <>
                  <button
                    type="button"
                    onClick={() => openOrderSheet(drop, winner)}
                    className="w-full py-2.5 bg-[#3eb489] hover:bg-[#359970] text-white font-semibold rounded-xl text-sm transition-colors"
                  >
                    Order Now
                  </button>
                  <DesignStudioBanner compact className="mt-3" />
                </>
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
    return (
      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
        {winner?.mockupUrl && (
          <div className="w-48 h-48 mx-auto rounded-xl overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={winner.mockupUrl} alt="" className="w-full h-full object-contain" />
          </div>
        )}
        <DropGuideCard
          {...buildDropGuideContent({ phase, drop, viewer, countdown })}
        />
      </div>
    );
  }

  return null;
}
