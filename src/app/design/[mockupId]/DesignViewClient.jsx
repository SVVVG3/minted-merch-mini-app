'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcaster } from '@/lib/useFarcaster';
import { useCart } from '@/lib/CartContext';
import { DESIGN_STUDIO_PRODUCTS } from '@/lib/designStudioConfig';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');

export function DesignViewClient({ mockupId }) {
  const router = useRouter();
  const { user, getSessionToken, isInFarcaster, sdk, sessionToken } = useFarcaster();
  const { addItem } = useCart();

  // Keep a ref that always holds the latest sessionToken so async handlers
  // don't get stale closures when the Quick Auth flow finishes after render.
  const sessionTokenRef = useRef(sessionToken);
  useEffect(() => { sessionTokenRef.current = sessionToken; }, [sessionToken]);

  const [mockup, setMockup] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Drop submission state
  const [dropModalOpen, setDropModalOpen] = useState(false);
  const [dropConfirmed, setDropConfirmed] = useState(false);
  const [dropSubmitting, setDropSubmitting] = useState(false);
  const [dropError, setDropError] = useState('');
  const [dropSuccess, setDropSuccess] = useState(false);
  const [currentDrop, setCurrentDrop] = useState(null); // { weekLabel, ... } if submissions open
  const [existingDropSubmission, setExistingDropSubmission] = useState(null); // { id, status, mockupId, isThisMockup }
  const [buyOpen, setBuyOpen] = useState(false);
  const [shopifyVariants, setShopifyVariants] = useState([]);
  const [selectedSize, setSelectedSize] = useState('');
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [buyAdded, setBuyAdded] = useState(false);

  // ── Load mockup data ───────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/design-studio/mockup/${mockupId}`);
        if (!res.ok) { setError('Design not found.'); return; }
        const data = await res.json();
        setMockup(data.mockup);
        setCreator(data.creator);
      } catch {
        setError('Could not load design.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mockupId]);

  // ── Derive product config ──────────────────────────────────────────────────
  const productConfig = mockup
    ? DESIGN_STUDIO_PRODUCTS.find(p => p.id === mockup.product_type)
    : null;

  // ── Is the current viewer the creator? ────────────────────────────────────
  // Must be declared before any useEffect that uses it in a dependency array.
  const isOwnDesign = !!(user?.fid && creator?.fid && String(user.fid) === String(creator.fid));

  // ── Check current drop + user's submission (creator viewing own design) ─────
  useEffect(() => {
    if (!mockup || !isOwnDesign) return;
    const token = getSessionToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/drops/current?mockupId=${mockupId}`, { headers })
      .then(r => r.json())
      .then(data => {
        setCurrentDrop(data.drop || null);
        setExistingDropSubmission(data.submission || null);
      })
      .catch(() => {});
  }, [mockup, isOwnDesign, mockupId, getSessionToken, user?.fid]);

  // ── Open buy sheet — fetch Shopify variants for this product + color ───────
  const openBuySheet = useCallback(async () => {
    if (!productConfig) return;
    setBuyOpen(true);
    setBuyError('');
    setSelectedSize('');
    setShopifyVariants([]);
    try {
      const colorParam = mockup?.color_name
        ? `&color=${encodeURIComponent(mockup.color_name)}`
        : '';
      const res = await fetch(
        `/api/design-studio/shopify-variants?productId=${encodeURIComponent(productConfig.shopifyProductId)}${colorParam}`
      );
      const data = await res.json();
      if (data.variants?.length) {
        setShopifyVariants(data.variants);
        setSelectedSize(data.variants[0]?.title || '');
      } else {
        setBuyError('Could not load sizes. Please try again.');
      }
    } catch (err) {
      setBuyError(`Could not load sizes: ${err.message}`);
    }
  }, [productConfig, mockup]);

  // ── Confirm purchase ───────────────────────────────────────────────────────
  const handleBuyConfirm = async () => {
    if (!selectedSize) { setBuyError('Please select a size.'); return; }

    // Quick Auth is asynchronous — the token may not be ready the instant the
    // user taps the button (especially on first page load via a shared link).
    // Wait up to 5 s for it to arrive before surfacing an error.
    let token = sessionTokenRef.current || getSessionToken();
    if (!token && isInFarcaster) {
      setBuyLoading(true);
      setBuyError('');
      for (let i = 0; i < 50 && !token; i++) {
        await new Promise(r => setTimeout(r, 100));
        token = sessionTokenRef.current;
      }
      if (!token) setBuyLoading(false);
    }
    if (!token) { setBuyError('Please connect your Farcaster account to buy.'); return; }

    setBuyLoading(true);
    setBuyError('');
    try {
      const matchedVariant = shopifyVariants.find(v => v.title === selectedSize) || shopifyVariants[0];
      if (!matchedVariant) throw new Error('No variant available for selected size.');

      const saveRes = await fetch('/api/design-studio/save-order-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId: mockup.product_type,
          size: selectedSize,
          colorName: mockup.color_name,
          technique: mockup.technique || productConfig?.technique || 'DTG',
          designUrl: mockup.design_url,
          mockupUrl: mockup.mockup_url,
          placement: mockup.placement || productConfig?.placement,
          designScale: mockup.design_scale,
          printfulVariantIds: mockup.printful_variant_ids || null,
          positionData: mockup.position_data || null,
          creatorFid: null, // creator buying their own design — no royalty split
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save design request');
      const designRequestId = saveData.id;

      const cartProduct = {
        id: productConfig.shopifyProductId,
        title: `Design Studio Custom ${productConfig.label}`,
        handle: `design-studio-custom-${productConfig.id}`,
        images: { edges: [] },
      };
      const cartVariant = {
        id: matchedVariant.id,
        title: matchedVariant.title,
        price: { amount: String(matchedVariant.price), currencyCode: 'USD' },
        image: null,
      };
      addItem(cartProduct, cartVariant, 1, {
        customImageUrl: mockup.mockup_url,
        customMeta: {
          designRequestId,
          productType: mockup.product_type,
          colorName: mockup.color_name,
          technique: mockup.technique || productConfig?.technique || 'DTG',
          placement: mockup.placement,
        },
      });

      setBuyAdded(true);
      setBuyOpen(false);
      router.push('/?openCart=1');
    } catch (err) {
      setBuyError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBuyLoading(false);
    }
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const designUrl = `${APP_URL}/design/${mockupId}`;
    const creatorHandle = creator?.username ? `@${creator.username}` : 'a creator';
    const productLabel = productConfig?.label || mockup?.product_type || 'design';
    const text = `Check out my custom merch design 👀\n\nCreate & order your own on @mintedmerch 👇`;

    if (isInFarcaster && sdk) {
      try {
        await sdk.actions.composeCast({ text, embeds: [designUrl] });
        return;
      } catch { /* fall through */ }
    }
    window.open(
      `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(designUrl)}`,
      '_blank'
    );
  };

  // ── Submit for weekly drop ─────────────────────────────────────────────────
  const handleSubmitForDrop = async () => {
    let token = sessionTokenRef.current || getSessionToken();
    if (!token && isInFarcaster) {
      for (let i = 0; i < 50 && !token; i++) {
        await new Promise(r => setTimeout(r, 100));
        token = sessionTokenRef.current;
      }
    }
    if (!token) { setDropError('Please connect your Farcaster account.'); return; }

    setDropSubmitting(true);
    setDropError('');
    try {
      const res = await fetch('/api/drops/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mockupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit.');
      setDropSuccess(true);
      setExistingDropSubmission({ status: 'submitted', mockupId, isThisMockup: true });
    } catch (err) {
      setDropError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setDropSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3eb489]" />
      </div>
    );
  }

  if (error || !mockup) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-gray-500 text-center">{error || 'Design not found.'}</p>
        <button
          onClick={() => router.push('/create')}
          className="px-6 py-3 bg-[#3eb489] text-white font-semibold rounded-2xl"
        >
          Create Your Own
        </button>
      </div>
    );
  }

  const techniqueLabel =
    productConfig?.techniqueLabel ||
    (mockup.technique === 'EMBROIDERY' ? 'Embroidery' : 'DTG Print');

  const isSublimation = productConfig?.technique === 'SUBLIMATION' || mockup.technique === 'CUT-SEW' || mockup.technique === 'SUBLIMATION';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pb-10">
      {/* Header */}
      <div className="w-full max-w-sm px-4 pt-5 pb-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/create')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-gray-700">
          {isOwnDesign
            ? 'Your Mockup'
            : creator?.username
            ? `Design by @${creator.username}`
            : 'Custom Design'}
        </p>
        <div className="w-9" />
      </div>

      {/* Mockup image */}
      <div className="w-full max-w-sm px-4">
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mockup.mockup_url}
            alt="Custom design mockup"
            className="w-full aspect-square object-contain"
          />
        </div>
      </div>

      {/* Product + creator info */}
      <div className="w-full max-w-sm px-4 mt-4 space-y-3">
        {/* Product details — price only shown to the creator */}
        <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {productConfig?.label || mockup.product_type}
              {!isSublimation && mockup.color_name ? ` · ${mockup.color_name}` : ''}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{techniqueLabel}</p>
          </div>
          {isOwnDesign && (
            <p className="text-sm font-bold text-[#3eb489]">
              {shopifyVariants.length > 0
                ? `$${parseFloat(shopifyVariants[0].price).toFixed(2)}`
                : productConfig?.displayPrice
                  ? `$${productConfig.displayPrice.toFixed(2)}`
                  : '—'}
            </p>
          )}
        </div>

        {/* Creator attribution */}
        {creator && (
          <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 flex items-center gap-3">
            {creator.pfpUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={creator.pfpUrl}
                alt={creator.username || 'Creator'}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Designed by</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {creator.username ? `@${creator.username}` : creator.displayName || `FID ${creator.fid}`}
                </p>
                {creator.isMerchMogul && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={creator.isGoldMogul ? '/GoldVerifiedMerchMogulBadge.png' : '/VerifiedMerchMogulBadge.png'}
                    alt="Merch Mogul"
                    className="h-5 flex-shrink-0"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-sm px-4 mt-5 space-y-3">
        {isOwnDesign ? (
          <>
            {/* Creator view: Buy → Share → (List in Shop for moguls) */}
            <button
              onClick={openBuySheet}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3eb489] hover:bg-[#35a07a] text-white font-semibold rounded-2xl transition-colors shadow-md text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Buy This Design
            </button>

            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-semibold rounded-2xl transition-colors shadow-md text-base"
            >
              <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
              </svg>
              Share on Farcaster
            </button>

            {currentDrop && (
              existingDropSubmission ? (
                <div className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-sm font-semibold ${
                  existingDropSubmission.status === 'winner'
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : existingDropSubmission.status === 'finalist'
                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                    : existingDropSubmission.status === 'rejected'
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-amber-50 border-amber-300 text-amber-700'
                }`}>
                  {existingDropSubmission.status === 'winner' && '🏆 Winner — This Week\'s Drop!'}
                  {existingDropSubmission.status === 'finalist' && '⭐ Finalist — Voting in Progress'}
                  {existingDropSubmission.status === 'rejected' && '❌ Not Selected This Week'}
                  {existingDropSubmission.status === 'submitted' && (
                    existingDropSubmission.isThisMockup === false
                      ? `✅ Submitted another design for ${currentDrop.weekLabel}`
                      : `✅ Submitted for ${currentDrop.weekLabel}`
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { setDropModalOpen(true); setDropConfirmed(false); setDropError(''); setDropSuccess(false); }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors text-base"
                >
                  🎯 Submit for {currentDrop.weekLabel}
                </button>
              )
            )}

            <button
              onClick={() => router.push('/create')}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors text-base"
            >
              🎨 Create Another Design
            </button>

            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors text-base"
            >
              🛍️ Back to Shop
            </button>
          </>
        ) : (
          <>
            {/* Non-creator view: Share → Create Your Own → Back to Shop */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-semibold rounded-2xl transition-colors shadow-md text-base"
            >
              <svg className="w-5 h-5" viewBox="0 0 520 457" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z" fill="currentColor"/>
              </svg>
              Share on Farcaster
            </button>

            <button
              onClick={() => router.push('/create')}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors text-base"
            >
              🎨 Create Your Own
            </button>

            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors text-base"
            >
              🛍️ Back to Shop
            </button>
          </>
        )}
      </div>

      {/* Buy sheet bottom drawer */}
      {buyOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBuyOpen(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            <h2 className="text-base font-bold text-gray-900 mb-1">
              Custom {productConfig?.label || mockup.product_type}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {isSublimation
                ? techniqueLabel
                : <>{mockup.color_name || ''}{mockup.color_name && ' · '}{techniqueLabel}</>
              }
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

            {buyError && (
              <p className="text-red-500 text-sm mb-3">{buyError}</p>
            )}

            <button
              onClick={handleBuyConfirm}
              disabled={buyLoading || !selectedSize}
              className="w-full py-3.5 bg-[#3eb489] disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors text-base"
            >
              {buyLoading ? 'Adding to cart…' : (() => {
                const matched = shopifyVariants.find(v => v.title === selectedSize) || shopifyVariants[0];
                const price = matched?.price ?? productConfig?.displayPrice;
                return `Add to Cart · ${price ? `$${parseFloat(price).toFixed(2)}` : '—'}`;
              })()}
            </button>
          </div>
        </div>
      )}

      {/* Drop submission confirmation modal */}
      {dropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => !dropSubmitting && setDropModalOpen(false)} />
          <div className="relative bg-white rounded-3xl px-6 pt-6 pb-7 shadow-2xl w-full max-w-sm">
            {dropSuccess ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="text-lg font-bold text-gray-900">Submitted!</h2>
                <p className="text-sm text-gray-500">
                  Your design is in for {currentDrop?.weekLabel}. Merch Moguls will vote on finalists — good luck!
                </p>
                <button
                  onClick={() => setDropModalOpen(false)}
                  className="mt-2 w-full py-3 bg-[#3eb489] text-white font-semibold rounded-2xl text-base"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-gray-900 mb-2">Submit for {currentDrop?.weekLabel}</h2>
                <p className="text-sm text-gray-500 mb-5">
                  One submission per week. If selected, your design could become a limited drop (37 units) with a creator payout.
                </p>

                <label className="flex items-start gap-3 cursor-pointer mb-5">
                  <div
                    onClick={() => setDropConfirmed(v => !v)}
                    className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                      dropConfirmed ? 'bg-[#3eb489] border-[#3eb489]' : 'bg-white border-gray-300'
                    }`}
                  >
                    {dropConfirmed && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 leading-relaxed">
                    I confirm this is my original design, or I have explicit permission to use it on merchandise.
                  </span>
                </label>

                {dropError && (
                  <p className="text-red-500 text-sm mb-3">{dropError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setDropModalOpen(false)}
                    disabled={dropSubmitting}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitForDrop}
                    disabled={!dropConfirmed || dropSubmitting}
                    className="flex-1 py-3 bg-[#3eb489] disabled:opacity-40 text-white font-semibold rounded-2xl text-base"
                  >
                    {dropSubmitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
