'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcaster } from '@/lib/useFarcaster';
import { useCart } from '@/lib/CartContext';
import { DESIGN_STUDIO_PRODUCTS } from '@/lib/designStudioConfig';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
const MERCH_MOGUL_THRESHOLD = 50_000_000;

export function DesignViewClient({ mockupId }) {
  const router = useRouter();
  const { user, getSessionToken, isInFarcaster, sdk } = useFarcaster();
  const { addItem } = useCart();

  const [mockup, setMockup] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Buy sheet state
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

  // ── Open buy sheet — fetch Shopify variants for this product + color ───────
  const openBuySheet = useCallback(async () => {
    if (!productConfig) return;
    setBuyOpen(true);
    setBuyError('');
    setSelectedSize('');
    setShopifyVariants([]);
    try {
      const colorParam = mockup?.color_name
        ? `&colorName=${encodeURIComponent(mockup.color_name)}`
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
    const sessionToken = getSessionToken();
    if (!sessionToken) { setBuyError('Please connect your Farcaster account to buy.'); return; }

    setBuyLoading(true);
    setBuyError('');
    try {
      const matchedVariant = shopifyVariants.find(v => v.title === selectedSize) || shopifyVariants[0];
      if (!matchedVariant) throw new Error('No variant available for selected size.');

      // Save design order request, passing creator FID for attribution
      // Only set creatorFid when buying someone else's design (not your own)
      const isOwnDesign = creator?.fid != null && user?.fid != null && creator.fid === user.fid;
      const saveRes = await fetch('/api/design-studio/save-order-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
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
          creatorFid: isOwnDesign ? null : (creator?.fid || null),
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save design request');
      const designRequestId = saveData.id;

      // Add to cart
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
      // Navigate home with cart open
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
    const text = `Check out this custom ${productLabel} by ${creatorHandle} on @mintedmerch! 🎨\n\nBuy it or create your own 👇`;

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

  const techniqueLabel = mockup.technique === 'EMBROIDERY' ? 'Embroidery' : 'DTG Print';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pb-10">
      {/* Header */}
      <div className="w-full max-w-sm px-4 pt-5 pb-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-gray-700">Your Mockup</p>
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
        {/* Product details */}
        <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {productConfig?.label || mockup.product_type}
              {mockup.color_name ? ` · ${mockup.color_name}` : ''}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{techniqueLabel}</p>
          </div>
          <p className="text-sm font-bold text-[#3eb489]">
            ${productConfig?.displayPrice?.toFixed(2) || '—'}
          </p>
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
              <p className="text-sm font-semibold text-gray-800 truncate">
                {creator.username ? `@${creator.username}` : creator.displayName || `FID ${creator.fid}`}
                {creator.isMerchMogul && (
                  <span className="ml-1.5 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                    Merch Mogul
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-sm px-4 mt-5 space-y-3">
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
          <svg className="w-5 h-5" viewBox="0 0 520 457" fill="currentColor">
            <path d="M261.86 69.36 L340.92 0 L340.92 138.72 C399.26 143.02 445.08 164.58 478.3 199.4 C511.52 234.22 519.6 276.12 519.08 323.72 C494.88 296.04 469.06 275.56 441.62 262.28 C414.18 248.98 383.62 242.34 349.94 242.34 L340.92 242.34 L340.92 384.54 Z" />
          </svg>
          Share on Farcaster
        </button>

        <button
          onClick={() => router.push('/create')}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors text-base"
        >
          🎨 Create Your Own
        </button>
      </div>

      {/* Buy sheet bottom drawer */}
      {buyOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBuyOpen(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-xl">
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            <h2 className="text-base font-bold text-gray-900 mb-1">
              Custom {productConfig?.label || mockup.product_type}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {mockup.color_name || ''}{mockup.color_name && ' · '}{techniqueLabel}
            </p>

            {/* Size selector */}
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

            {buyError && (
              <p className="text-red-500 text-sm mb-3">{buyError}</p>
            )}

            <button
              onClick={handleBuyConfirm}
              disabled={buyLoading || !selectedSize}
              className="w-full py-3.5 bg-[#3eb489] disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors text-base"
            >
              {buyLoading ? 'Adding to cart…' : `Add to Cart · $${productConfig?.displayPrice?.toFixed(2) || '—'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
