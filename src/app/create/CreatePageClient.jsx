'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';
import { DESIGN_STUDIO_PRODUCTS } from '@/lib/designStudioConfig';
import { useCart } from '@/lib/CartContext';

export function CreatePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, getSessionToken, isInFarcaster, getPfpUrl } = useFarcaster();
  const { addItem } = useCart();

  // ─── Step state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState('product');

  // Product
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Technique (null | 'DTG' | 'EMBROIDERY') — for products that offer a choice (hoodies)
  const [selectedTechnique, setSelectedTechnique] = useState(null);

  // Color / variants
  const [colors, setColors] = useState([]);
  const [colorsLoading, setColorsLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);

  // Image upload
  const [designUrl, setDesignUrl] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Template / live preview
  const [template, setTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  // Design placement + scale
  const [designPlacement, setDesignPlacement] = useState('center'); // 'center' | 'leftchest'
  const [designScale, setDesignScale] = useState(0.85);

  // Generation
  const [taskKey, setTaskKey] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const pollTimerRef = useRef(null);

  // Result
  const [mockupUrl, setMockupUrl] = useState('');

  // Product preview images (black variant thumbnails)
  const [productImages, setProductImages] = useState({});

  // Mockup history
  const [myMockups, setMyMockups] = useState([]);
  const [mockupsLoading, setMockupsLoading] = useState(false);

  // Errors
  const [error, setError] = useState('');

  // Buy / size picker
  const [showBuySheet, setShowBuySheet] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyAdded, setBuyAdded] = useState(false);
  const [buyError, setBuyError] = useState('');
  // Real Shopify variants fetched when buy sheet opens
  const [shopifyVariants, setShopifyVariants] = useState([]); // [{ id, title, price }]
  const [variantsLoading, setVariantsLoading] = useState(false);
  // When buying from past-mockup history (not the current result)
  const [historyMockup, setHistoryMockup] = useState(null);

  // ─── Cast-action pre-fill ─────────────────────────────────────────────────
  // When opened via the Farcaster cast action, castImageUrl param carries the
  // image from the cast. We re-upload it to R2 then skip straight to the
  // product picker with the image already set.
  const [castImageLoading, setCastImageLoading] = useState(false);
  const [castImagePrefilled, setCastImagePrefilled] = useState(false);
  const castImageProcessed = useRef(false); // prevent double-processing

  // ─── Load user's past mockups ─────────────────────────────────────────────
  const loadMyMockups = useCallback(async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    setMockupsLoading(true);
    try {
      const res = await fetch('/api/design-studio/my-mockups', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (data.success) setMyMockups(data.mockups || []);
    } catch {
      // non-critical, ignore
    } finally {
      setMockupsLoading(false);
    }
  }, [getSessionToken]);

  useEffect(() => {
    if (user?.fid) loadMyMockups();
  }, [user?.fid, loadMyMockups]);

  // ─── Process castImageUrl param (from Farcaster cast action) ─────────────
  useEffect(() => {
    const rawCastImageUrl = searchParams?.get('castImageUrl');
    if (!rawCastImageUrl || castImageProcessed.current) return;

    const sessionToken = getSessionToken();
    if (!sessionToken) return; // wait for auth

    castImageProcessed.current = true;
    setCastImageLoading(true);

    (async () => {
      try {
        // Re-upload to R2 so Printful can always access it regardless of CDN restrictions
        const res = await fetch('/api/design-studio/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ url: rawCastImageUrl }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Failed to load image');

        setDesignUrl(data.url);
        setCastImagePrefilled(true);
        console.log(`🎨 Cast image loaded from action: ${data.url}`);
      } catch (err) {
        console.error('Cast image pre-fill error:', err);
        // Non-fatal — user can still upload manually
      } finally {
        setCastImageLoading(false);
      }
    })();
  }, [searchParams, getSessionToken]); // re-run when auth becomes available

  // ─── Fallback: read cast hash from sdk.context when app opened via castShareUrl ─
  // When opened via the "Mini apps" share sheet Farcaster provides the cast hash
  // in sdk.context.cast (no image URL). We look up the image server-side.
  useEffect(() => {
    // Only run if there's no castImageUrl query param (that flow is handled above)
    const hasCastImageParam = !!searchParams?.get('castImageUrl');
    if (hasCastImageParam || castImageProcessed.current) return;

    const sessionToken = getSessionToken();
    if (!sessionToken) return; // wait for auth

    // Read cast hash from the Farcaster SDK context (set by FrameInit)
    const context = typeof window !== 'undefined' ? window.farcasterContext : null;
    const castHash = context?.cast?.hash || context?.location?.cast?.hash;
    if (!castHash) return;

    castImageProcessed.current = true;
    setCastImageLoading(true);

    (async () => {
      try {
        // Look up the cast's first image embed via our API
        const lookupRes = await fetch(
          `/api/design-studio/cast-image?hash=${encodeURIComponent(castHash)}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        const lookupData = await lookupRes.json();
        if (!lookupData.imageUrl) return; // cast has no image embed — proceed normally

        // Re-upload to R2 so Printful can always access it
        const r2Res = await fetch('/api/design-studio/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ url: lookupData.imageUrl }),
        });
        const r2Data = await r2Res.json();
        if (!r2Res.ok || !r2Data.url) throw new Error(r2Data.error || 'R2 upload failed');

        setDesignUrl(r2Data.url);
        setCastImagePrefilled(true);
        console.log(`🎨 Cast image loaded from context: ${r2Data.url}`);
      } catch (err) {
        console.error('Cast context image pre-fill error:', err);
      } finally {
        setCastImageLoading(false);
      }
    })();
  // Re-run when auth token becomes available (user might not be authenticated yet on first render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.fid]);

  // Auto-advance past the upload step when the cast image is already loaded
  useEffect(() => {
    if (step === 'upload' && castImagePrefilled && designUrl) {
      setStep('preview');
    }
  }, [step, castImagePrefilled, designUrl]);

  // ─── Product image cache helpers (localStorage, 24h TTL) ─────────────────
  // v5: use catalog variant image (productImage) — reliable, colored, no extra API call
  const PROD_IMG_CACHE = 'ds_product_imgs_v5';
  const CACHE_TTL = 24 * 60 * 60 * 1000;

  function getCachedImages() {
    try {
      const raw = localStorage.getItem(PROD_IMG_CACHE);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const now = Date.now();
      const valid = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (v.ts && now - v.ts < CACHE_TTL) valid[k] = v.url;
      });
      return valid;
    } catch { return {}; }
  }

  function setCachedImage(productId, url) {
    try {
      const raw = localStorage.getItem(PROD_IMG_CACHE);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[productId] = { url, ts: Date.now() };
      localStorage.setItem(PROD_IMG_CACHE, JSON.stringify(parsed));
    } catch {}
  }

  // Pre-fetch the catalog image for the black variant of each product.
  // Using catalog variant images (productImage) because Printful's template images
  // are white/neutral regardless of variant — they can't be used for color display.
  // The catalog images reliably show the actual product color. Cached 24h in localStorage.
  useEffect(() => {
    const cached = getCachedImages();
    if (Object.keys(cached).length > 0) setProductImages(cached);

    const needsFetch = DESIGN_STUDIO_PRODUCTS.filter(p => !cached[p.id]);
    if (needsFetch.length === 0) return;

    Promise.all(
      needsFetch.map(async (product) => {
        try {
          const varRes = await fetch(`/api/design-studio/variants/${product.printfulProductId}`);
          const varData = await varRes.json();
          // productImage is set by the variants route to the black variant's catalog image
          return { id: product.id, image: varData.productImage || null };
        } catch {
          return { id: product.id, image: null };
        }
      })
    ).then(results => {
      const map = { ...cached };
      results.forEach(r => {
        if (r.image) {
          map[r.id] = r.image;
          setCachedImage(r.id, r.image);
        }
      });
      setProductImages(map);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save mockup to DB when result arrives ────────────────────────────────
  useEffect(() => {
    if (!mockupUrl || step !== 'result') return;
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    fetch('/api/design-studio/save-mockup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        mockupUrl,
        productType: selectedProduct?.id,
        colorName: selectedColor?.name,
      }),
    })
      .then(() => loadMyMockups())
      .catch(console.error);
  }, [mockupUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch colors when product selected ──────────────────────────────────
  const loadColors = useCallback(async (product) => {
    setColorsLoading(true);
    setColors([]);
    setSelectedColor(null);
    setError('');
    try {
      const res = await fetch(`/api/design-studio/variants/${product.printfulProductId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load colors');
      setColors(data.colors);
    } catch (err) {
      setError(`Could not load color options: ${err.message}`);
    } finally {
      setColorsLoading(false);
    }
  }, []);

  // ─── Fetch template for live preview ─────────────────────────────────────
  const loadTemplate = useCallback(async (product, color, techniqueOverride) => {
    setTemplateLoading(true);
    setTemplate(null);
    try {
      const variantId = color.variantIds[0];
      const rawTechnique = techniqueOverride || product.technique;
      // Printful only accepts 'EMBROIDERY' as a technique override; DTG is the default
      const effectiveTechnique = (rawTechnique === 'DTG') ? null : rawTechnique;
      const technique = effectiveTechnique ? `&technique=${effectiveTechnique}` : '';
      console.log(`🔍 Loading template for product ${product.printfulProductId}, variantId ${variantId}`);
      const res = await fetch(
        `/api/design-studio/templates/${product.printfulProductId}?variantId=${variantId}${technique}`
      );
      const data = await res.json();
      if (data.template) {
        console.log('✅ Template loaded:', data.template.template_id, `${data.template.template_width}×${data.template.template_height}`);
        setTemplate(data.template);
      } else {
        console.warn('⚠️ No template returned:', data.error || 'unknown reason');
      }
    } catch (err) {
      console.error('Template load error:', err.message);
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  // ─── File upload handler ──────────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file) return;
    const sessionToken = getSessionToken();
    if (!sessionToken) { setError('Please sign in to upload a design.'); return; }
    setIsUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/design-studio/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setDesignUrl(data.url);
      loadTemplate(selectedProduct, selectedColor, selectedTechnique); // async, don't await
      setStep('preview');
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── URL paste handler ────────────────────────────────────────────────────
  const handleUrlSubmit = async () => {
    if (!pasteUrl.trim()) return;
    setError('');
    try { new URL(pasteUrl); } catch { setError('Please enter a valid image URL.'); return; }
    setDesignUrl(pasteUrl.trim());
    loadTemplate(selectedProduct, selectedColor, selectedTechnique);
    setStep('preview');
  };

  // ─── Generate mockup ──────────────────────────────────────────────────────
  // Position is always computed server-side from Printful printfile coordinates.
  // We only send designScale and designPlacement so the server can calculate it.
  const handleGenerate = async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) { setError('Please sign in to generate a mockup.'); return; }
    setError('');
    setStep('generating');

    try {
      const res = await fetch('/api/design-studio/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          productId: selectedProduct.id,
          variantIds: selectedColor.variantIds.slice(0, 3),
          imageUrl: designUrl,
          designScale,
          designPlacement,
          technique: selectedTechnique || selectedProduct.technique || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to start generation');
      setTaskKey(data.taskKey);
      setPollCount(0);
    } catch (err) {
      setError(`Generation failed: ${err.message}`);
      setStep('preview');
    }
  };

  // ─── Poll for task result ─────────────────────────────────────────────────
  useEffect(() => {
    if (!taskKey || step !== 'generating') return;

    const poll = async () => {
      const sessionToken = getSessionToken();
      if (!sessionToken) return;
      try {
        const res = await fetch(
          `/api/design-studio/task-status?task_key=${encodeURIComponent(taskKey)}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        const data = await res.json();

        if (data.status === 'completed' && data.mockupUrl) {
          setMockupUrl(data.mockupUrl);
          setStep('result');
          return;
        }
        if (data.status === 'failed') {
          setError(data.error || 'Mockup generation failed. Please try again.');
          setStep('preview');
          return;
        }
        setPollCount(c => c + 1);
        if (pollCount < 20) {
          pollTimerRef.current = setTimeout(poll, 3000);
        } else {
          setError('Generation timed out. Please try again.');
          setStep('preview');
        }
      } catch {
        pollTimerRef.current = setTimeout(poll, 3000);
      }
    };

    pollTimerRef.current = setTimeout(poll, pollCount === 0 ? 10000 : 3000);
    return () => clearTimeout(pollTimerRef.current);
  }, [taskKey, step, pollCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Share on Farcaster ───────────────────────────────────────────────────
  const shareToFarcaster = async (url) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop';
    const text = `Check out my custom @mintedmerch design idea 👀\n\nCreate your own in the mini app!\n${appUrl}/create`;
    if (isInFarcaster) {
      await sdk.actions.composeCast({ text, embeds: [url] });
    } else {
      window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`, '_blank');
    }
  };

  const handleShare = async () => {
    try { await shareToFarcaster(mockupUrl); } catch (err) { console.error('Share error:', err); }
  };

  const handleShareMockup = async (url) => {
    try { await shareToFarcaster(url); } catch (err) { console.error('Share error:', err); }
  };

  // ─── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep('product');
    setSelectedProduct(null);
    setSelectedTechnique(null);
    setSelectedColor(null);
    setColors([]);
    setDesignUrl('');
    setPasteUrl('');
    setTemplate(null);
    setDesignScale(0.85);
    setDesignPlacement('center');
    setTaskKey('');
    setMockupUrl('');
    setError('');
    setBuyAdded(false);
    setBuyError('');
    setSelectedSize('');
    setShopifyVariants([]);
    setHistoryMockup(null);
    setCastImagePrefilled(false);
    castImageProcessed.current = false;
  };

  // ─── Buy (add to cart) ────────────────────────────────────────────────────

  // Fetch real Shopify variants when the buy sheet opens
  const openBuySheet = async () => {
    setShowBuySheet(true);
    setBuyError('');
    setShopifyVariants([]);
    setSelectedSize('');

    if (!selectedProduct?.shopifyProductId) return;
    setVariantsLoading(true);
    try {
      const colorParam = selectedColor?.name ? `&color=${encodeURIComponent(selectedColor.name)}` : '';
      const res = await fetch(
        `/api/design-studio/shopify-variants?productId=${encodeURIComponent(selectedProduct.shopifyProductId)}${colorParam}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const available = (data.variants || []).filter(v => v.availableForSale);
      setShopifyVariants(available);
      if (available.length > 0) setSelectedSize(available[0].title);
    } catch (err) {
      console.error('Variant fetch error:', err);
      setBuyError(`Could not load sizes: ${err.message}`);
    } finally {
      setVariantsLoading(false);
    }
  };

  // Open buy sheet for a past mockup (we don't have the original design, just the mockup)
  const openBuySheetForMockup = async (mockup) => {
    const productConfig = DESIGN_STUDIO_PRODUCTS.find(p => p.id === mockup.product_type);
    if (!productConfig) {
      console.error('No product config found for type:', mockup.product_type);
      return;
    }

    setHistoryMockup(mockup);
    setShowBuySheet(true);
    setBuyError('');
    setShopifyVariants([]);
    setSelectedSize('');

    if (!productConfig.shopifyProductId) return;
    setVariantsLoading(true);
    try {
      // Pass the mockup's color so the API returns only size variants for that color
      const colorParam = mockup.color_name ? `&color=${encodeURIComponent(mockup.color_name)}` : '';
      const res = await fetch(
        `/api/design-studio/shopify-variants?productId=${encodeURIComponent(productConfig.shopifyProductId)}${colorParam}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const available = (data.variants || []).filter(v => v.availableForSale);
      setShopifyVariants(available);
      if (available.length > 0) setSelectedSize(available[0].title);
    } catch (err) {
      console.error('shopify-variants fetch error:', err);
      setBuyError(`Could not load sizes: ${err.message}`);
    } finally {
      setVariantsLoading(false);
    }
  };

  // Delete a mockup (removes from DB + R2)
  const handleDeleteMockup = async (mockup) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;
    try {
      const res = await fetch(`/api/design-studio/my-mockups?id=${mockup.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        setMyMockups(prev => prev.filter(m => m.id !== mockup.id));
      }
    } catch (err) {
      console.error('Delete mockup error:', err);
    }
  };

  const handleBuyConfirm = async () => {
    if (!selectedSize) { setBuyError('Please select a size.'); return; }
    setBuyLoading(true);
    setBuyError('');

    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error('Please connect your Farcaster account first.');

      // Resolve the real Shopify variant for the selected size
      const matchedVariant = shopifyVariants.find(v => v.title === selectedSize)
        || shopifyVariants[0]; // fallback: first available
      if (!matchedVariant) throw new Error('No variant available for selected size.');

      // Resolve the effective product config: buying from history vs. current creation
      const effectiveProduct = historyMockup
        ? (DESIGN_STUDIO_PRODUCTS.find(p => p.id === historyMockup.product_type) || selectedProduct)
        : selectedProduct;
      const effectiveMockupUrl = historyMockup?.mockup_url || mockupUrl;
      const effectiveDesignUrl = historyMockup ? historyMockup.mockup_url : designUrl;
      const effectiveColorName = historyMockup ? historyMockup.color_name : (selectedColor?.name || null);
      const effectiveTechnique = historyMockup
        ? (effectiveProduct.technique || 'DTG')
        : (selectedTechnique || selectedProduct?.technique || 'DTG');

      // 1. Save design request to Supabase; returns a UUID for traceability
      const saveRes = await fetch('/api/design-studio/save-order-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          productId: effectiveProduct.id,
          size: selectedSize,
          colorName: effectiveColorName,
          technique: effectiveTechnique,
          designUrl: effectiveDesignUrl,
          mockupUrl: effectiveMockupUrl,
          placement: historyMockup ? effectiveProduct.placement : designPlacement,
          designScale: historyMockup ? null : designScale,
          printfulVariantIds: historyMockup ? null : (selectedColor?.variantIds || null),
          positionData: null, // position is computed server-side at generate time
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save design request');
      const designRequestId = saveData.id;

      // 2. Build a Shopify-compatible product/variant object for the cart
      //    using the REAL variant GID fetched from Shopify
      const cartProduct = {
        id: effectiveProduct.shopifyProductId,
        title: `Design Studio Custom ${effectiveProduct.label}`,
        handle: `design-studio-custom-${effectiveProduct.id}`,
        images: { edges: [] },
      };
      const cartVariant = {
        id: matchedVariant.id,            // real gid://shopify/ProductVariant/XXXX
        title: matchedVariant.title,      // actual size label from Shopify
        price: { amount: String(matchedVariant.price), currencyCode: 'USD' },
        image: null,
      };

      // 3. Add to cart — custom items carry the mockup image and design UUID
      addItem(cartProduct, cartVariant, 1, {
        customImageUrl: effectiveMockupUrl,
        customMeta: {
          designRequestId,
          productType: effectiveProduct.id,
          size: selectedSize,
          colorName: effectiveColorName,
        },
      });

      setShowBuySheet(false);
      setHistoryMockup(null);
      if (!historyMockup) setBuyAdded(true); // Only switch result screen for current creation

    } catch (err) {
      console.error('Buy error:', err);
      setBuyError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBuyLoading(false);
    }
  };

  // =========================================================================
  // ─── Dynamic step numbering ───────────────────────────────────────────────
  // Hoodies have an extra "technique" step → 5 steps total; others 4.
  const totalSteps = selectedProduct?.techniqueOptions ? 5 : 4;
  const stepNum = (s) => {
    if (selectedProduct?.techniqueOptions) {
      return { product: 1, technique: 2, color: 3, upload: 4, preview: 5 }[s] ?? 1;
    }
    return { product: 1, color: 2, upload: 3, preview: 4 }[s] ?? 1;
  };

  // ─── Step: Product Picker ─────────────────────────────────────────────────
  if (step === 'product') {
    const designStudioTitle = (
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/MintedMerchSpinnerLogo.png" alt="" className="h-6 w-auto flex-shrink-0" />
        Design Studio
      </span>
    );
    return (
      <>
      <PageShell onBack={() => router.push('/')} title={designStudioTitle} step={1} totalSteps={4}>
        <div className="flex flex-col items-center px-4 pt-4 pb-8">
          {/* Cast image pre-fill banners */}
          {castImageLoading && (
            <div className="w-full max-w-sm mb-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 flex items-center gap-2">
              <svg className="animate-spin w-4 h-4 text-[#3eb489] flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Loading image from cast…
            </div>
          )}
          {castImagePrefilled && !castImageLoading && (
            <div className="w-full max-w-sm mb-4 px-4 py-2.5 bg-[#3eb489]/10 border border-[#3eb489]/30 rounded-xl text-sm text-[#2a7a5c] flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Image loaded from cast — choose a product to continue
            </div>
          )}
          <p className="text-gray-500 text-sm text-center mb-6">
            Choose a product to put your design on:
          </p>
          <div className="w-full max-w-sm space-y-3">
            {DESIGN_STUDIO_PRODUCTS.map(product => (
              <button
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product);
                  setSelectedTechnique(null);
                  setDesignScale(product.defaultScale ?? 0.85);
                  setDesignPlacement('center');
                  if (product.techniqueOptions) {
                    // Hoodies ask for technique before loading colors
                    setStep('technique');
                  } else {
                    loadColors(product);
                    setStep('color');
                  }
                }}
                className="w-full flex items-center gap-4 bg-white border-2 border-gray-100 hover:border-[#3eb489] active:border-[#3eb489] rounded-2xl px-5 py-4 transition-all text-left shadow-sm"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                  {productImages[product.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImages[product.id]} alt={product.label} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">{product.emoji}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-lg">{product.label}</p>
                    {product.techniqueOptions ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                        DTG / Embroidery
                      </span>
                    ) : product.techniqueLabel ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                        {product.techniqueLabel}
                      </span>
                    ) : null}
                  </div>
                  {product.note && <p className="text-xs text-gray-400 mt-0.5">{product.note}</p>}
                </div>
                <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>

          {/* Past mockups gallery */}
          {myMockups.length > 0 && (
            <div className="w-full max-w-sm mt-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Past Mockups</h2>
              <div className="grid grid-cols-2 gap-3">
                {myMockups.slice(0, 6).map(m => (
                  <MockupCard
                    key={m.id}
                    mockup={m}
                    onShare={handleShareMockup}
                    onBuy={openBuySheetForMockup}
                    onDelete={handleDeleteMockup}
                  />
                ))}
              </div>
            </div>
          )}
          {error && <ErrorBanner message={error} />}
        </div>
      </PageShell>

      {/* Buy sheet — must be available from the product picker page too */}
      {showBuySheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="absolute inset-0" onClick={() => !buyLoading && (setShowBuySheet(false), setHistoryMockup(null))} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 z-10">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
            <h2 className="font-bold text-gray-900 text-lg mb-1">Select a Size</h2>
            <p className="text-sm text-gray-500 mb-5">
              {historyMockup
                ? `Custom ${DESIGN_STUDIO_PRODUCTS.find(p => p.id === historyMockup.product_type)?.label || historyMockup.product_type} · ${historyMockup.color_name || 'Custom Color'}`
                : `Custom ${selectedProduct?.label} · ${selectedColor?.name || 'Custom Color'}`}
            </p>
            {variantsLoading ? (
              <div className="flex items-center justify-center py-6 mb-5">
                <svg className="animate-spin w-6 h-6 text-[#3eb489]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="ml-2 text-sm text-gray-500">Loading sizes…</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-5">
                {(shopifyVariants.length > 0 ? shopifyVariants : (selectedProduct?.sizes || []).map(s => ({ id: s, title: s }))).map(variant => (
                  <button
                    key={variant.id || variant.title}
                    onClick={() => setSelectedSize(variant.title)}
                    className={`py-3 rounded-xl border-2 font-semibold text-sm transition-colors ${
                      selectedSize === variant.title
                        ? 'border-[#3eb489] bg-[#3eb489]/10 text-[#2a7a5c]'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {variant.title}
                  </button>
                ))}
              </div>
            )}
            {buyError && <p className="text-red-500 text-sm mb-3">{buyError}</p>}
            <button
              onClick={handleBuyConfirm}
              disabled={buyLoading || !selectedSize}
              className="w-full py-4 bg-[#3eb489] hover:bg-[#34a078] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-colors text-base flex items-center justify-center gap-2"
            >
              {buyLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Adding to Cart...
                </>
              ) : (() => {
                const matched = shopifyVariants.find(v => v.title === selectedSize);
                const price = matched?.price ?? (historyMockup
                  ? DESIGN_STUDIO_PRODUCTS.find(p => p.id === historyMockup.product_type)?.displayPrice
                  : selectedProduct?.displayPrice);
                return <>Add to Cart{price ? ` — $${parseFloat(price).toFixed(2)}` : ''}</>;
              })()}
            </button>
          </div>
        </div>
      )}
    </>
  );
  }

  // ─── Step: Technique Picker (hoodies only) ────────────────────────────────
  if (step === 'technique') {
    return (
      <PageShell onBack={() => setStep('product')} title={selectedProduct?.label} step={2} totalSteps={5}>
        <div className="flex flex-col items-center px-4 pt-4 pb-8">
          <p className="text-gray-500 text-sm text-center mb-6">Choose your printing method</p>
          <div className="w-full max-w-sm space-y-3">
            {/* DTG */}
            <button
              onClick={() => {
                setSelectedTechnique('DTG');
                setDesignScale(0.85);
                loadColors(selectedProduct);
                setStep('color');
              }}
              className="w-full flex items-start gap-4 bg-white border-2 border-gray-100 hover:border-[#3eb489] active:border-[#3eb489] rounded-2xl px-5 py-4 transition-all text-left shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🖨️</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">DTG Print</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Full color, photo-quality print. Best for detailed artwork, gradients, and photos. Infinite colors.
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Embroidery */}
            <button
              onClick={() => {
                setSelectedTechnique('EMBROIDERY');
                setDesignScale(0.45);
                setDesignPlacement('center');
                loadColors(selectedProduct);
                setStep('color');
              }}
              className="w-full flex items-start gap-4 bg-white border-2 border-gray-100 hover:border-[#3eb489] active:border-[#3eb489] rounded-2xl px-5 py-4 transition-all text-left shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🧵</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">Embroidery</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Stitched thread design. Premium, textured look. Best for simple logos with 5 or fewer colors. No photo backgrounds.
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {error && <ErrorBanner message={error} />}
        </div>
      </PageShell>
    );
  }

  // ─── Step: Color Picker ───────────────────────────────────────────────────
  if (step === 'color') {
    const colorStepBack = selectedProduct?.techniqueOptions ? 'technique' : 'product';
    return (
      <PageShell onBack={() => setStep(colorStepBack)} title={selectedProduct?.label} step={stepNum('color')} totalSteps={totalSteps}>
        <div className="flex flex-col items-center px-4 pt-4 pb-8">
          <p className="text-gray-500 text-sm text-center mb-6">Choose a color</p>
          {colorsLoading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]" />
              <p className="text-sm text-gray-400">Loading colors…</p>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              <div className="grid grid-cols-3 gap-3">
                {colors.map(color => (
                  <button
                    key={color.name}
                    onClick={() => { setSelectedColor(color); setStep('upload'); }}
                    title={color.name}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden border-2 border-gray-200 group-hover:border-[#3eb489] active:border-[#3eb489] transition-all shadow-sm bg-gray-50">
                      {color.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={color.image} alt={color.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: color.code }} />
                      )}
                    </div>
                    {/* Color swatch dot + name */}
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: color.code }} />
                      <span className="text-[10px] text-gray-500 leading-tight truncate">{color.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              {colors.length === 0 && !colorsLoading && (
                <p className="text-center text-gray-400 text-sm py-8">No colors found for this product.</p>
              )}
            </div>
          )}
          {error && <ErrorBanner message={error} />}
        </div>
      </PageShell>
    );
  }

  // ─── Step: Upload Image ───────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <PageShell onBack={() => setStep('color')} title="Upload Your Design" step={stepNum('upload')} totalSteps={totalSteps}>
        <div className="flex flex-col items-center px-4 pt-4 pb-8">
          {/* Color reminder */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: selectedColor?.code }} />
            <span className="text-sm text-gray-500">{selectedColor?.name} {selectedProduct?.label}</span>
          </div>

          {/* File upload area */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full max-w-sm flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 hover:border-[#3eb489] rounded-2xl py-12 px-6 transition-all bg-white disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]" />
                <p className="text-sm text-gray-500">Uploading…</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-[#3eb489]/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#3eb489]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-700">Tap to upload image</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPEG, WebP — max 10 MB</p>
                </div>
              </>
            )}
          </button>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e.target.files?.[0])} />

          {/* Profile picture shortcut — re-uploads to R2 so Printful can always fetch it */}
          {getPfpUrl?.() && (
            <button
              onClick={async () => {
                const sessionToken = getSessionToken();
                if (!sessionToken) { setError('Please sign in first.'); return; }
                setIsUploading(true);
                setError('');
                try {
                  const res = await fetch('/api/design-studio/fetch-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
                    body: JSON.stringify({ url: getPfpUrl() }),
                  });
                  const data = await res.json();
                  if (!data.success) throw new Error(data.error || 'Upload failed');
                  setDesignUrl(data.url);
                  loadTemplate(selectedProduct, selectedColor, selectedTechnique);
                  setStep('preview');
                } catch (err) {
                  setError(`Could not use profile picture: ${err.message}`);
                } finally {
                  setIsUploading(false);
                }
              }}
              disabled={isUploading}
              className="w-full max-w-sm flex items-center gap-3 bg-white border-2 border-gray-100 hover:border-[#3eb489] rounded-2xl px-4 py-3 transition-all mt-3 disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getPfpUrl()} alt="Your profile" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
              <div className="text-left">
                <p className="font-medium text-gray-700 text-sm">
                  {isUploading ? 'Uploading…' : 'Use My Profile Picture'}
                </p>
                <p className="text-xs text-gray-400">@{user?.username || 'you'}</p>
              </div>
              {!isUploading && (
                <svg className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center w-full max-w-sm my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="px-3 text-xs text-gray-400">or paste an image URL</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* URL paste */}
          <div className="w-full max-w-sm flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/my-design.png"
              value={pasteUrl}
              onChange={e => setPasteUrl(e.target.value)}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3eb489] focus:border-transparent"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!pasteUrl.trim()}
              className="px-4 py-2.5 bg-[#3eb489] hover:bg-[#359970] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
            >
              Use
            </button>
          </div>
          {error && <ErrorBanner message={error} />}
        </div>
      </PageShell>
    );
  }

  // ─── Step: Live Preview + Generate ───────────────────────────────────────
  if (step === 'preview') {
    const PREVIEW_WIDTH = 280;
    const displayRatio = template ? PREVIEW_WIDTH / template.template_width : 1;
    // Embroidery (hats always, hoodies when embroidery technique chosen) → no placement toggle
    const isEmbroidery = selectedProduct?.id === 'hat' || selectedTechnique === 'EMBROIDERY';
    const showPlacementOptions = !isEmbroidery;

    // Compute design position in preview coords
    let previewDesign = null;
    if (template) {
      const paTop = Math.round(template.print_area_top * displayRatio);
      const paLeft = Math.round(template.print_area_left * displayRatio);
      const paW = Math.round(template.print_area_width * displayRatio);
      const paH = Math.round(template.print_area_height * displayRatio);

      if (designPlacement === 'leftchest' && showPlacementOptions) {
        // Wearer's LEFT chest = viewer's RIGHT side of the template image.
        // Mirror the server-side logic: left = 62% of print area width.
        const shorter = Math.min(paW, paH);
        const sz = Math.round(shorter * 0.28);
        previewDesign = {
          top: paTop + Math.round(paH * 0.08),    // 8% from top — matches server
          left: paLeft + Math.round(paW * 0.62),  // 62% from left = viewer's right
          width: sz,
          height: sz,
        };
      } else {
        // Centered — keep square, scaled off shorter axis
        const shorter = Math.min(paW, paH);
        const sz = Math.round(shorter * designScale);
        previewDesign = { top: paTop + Math.round((paH - sz) / 2), left: paLeft + Math.round((paW - sz) / 2), width: sz, height: sz };
      }
    }

    return (
      <PageShell onBack={() => setStep('upload')} title="Preview & Generate" step={stepNum('preview')} totalSteps={totalSteps}>
        <div className="flex flex-col items-center px-4 pt-4 pb-8">

          {/* Placement picker — shirts & hoodies only */}
          {showPlacementOptions && (
            <div className="flex gap-2 mb-4 w-full max-w-sm">
              <button
                onClick={() => setDesignPlacement('center')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${designPlacement === 'center' ? 'border-[#3eb489] bg-[#3eb489]/10 text-[#3eb489]' : 'border-gray-200 text-gray-500 bg-white'}`}
              >
                ⬜ Full Front
              </button>
              <button
                onClick={() => setDesignPlacement('leftchest')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${designPlacement === 'leftchest' ? 'border-[#3eb489] bg-[#3eb489]/10 text-[#3eb489]' : 'border-gray-200 text-gray-500 bg-white'}`}
              >
                ◻ Left Chest
              </button>
            </div>
          )}

          {templateLoading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]" />
              <p className="text-sm text-gray-400">Loading preview…</p>
            </div>
          ) : template ? (
            <>
              {/* Live preview canvas */}
              <div
                className="relative rounded-xl overflow-hidden shadow-md mx-auto"
                style={{
                  width: PREVIEW_WIDTH,
                  height: Math.round(template.template_height * displayRatio),
                  backgroundColor: selectedColor?.code || '#f3f4f6',
                }}
              >
                {/* Product template — render BEHIND the design */}
                {!template.is_template_on_front && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={template.image_url}
                    alt={selectedProduct?.label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* User's design overlaid on the print area */}
                {previewDesign && (
                  <div
                    className="absolute"
                    style={{
                      top: previewDesign.top,
                      left: previewDesign.left,
                      width: previewDesign.width,
                      height: previewDesign.height,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={designUrl} alt="Your design" className="w-full h-full object-contain" />
                  </div>
                )}

                {/* Product template — render ON TOP of the design (overlay effect) */}
                {template.is_template_on_front && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={template.image_url}
                    alt={selectedProduct?.label}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                )}
              </div>

                  {/* Scale slider — shown for all products */}
              {(designPlacement === 'center' || !showPlacementOptions) && (
                <div className="w-full max-w-sm mt-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Design size</span>
                    <span className="text-xs font-medium text-gray-700">{Math.round(designScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={isEmbroidery ? '0.2' : '0.3'}
                    max={isEmbroidery ? '0.7' : '1.2'}
                    step="0.05"
                    value={designScale}
                    onChange={e => setDesignScale(parseFloat(e.target.value))}
                    className="w-full accent-[#3eb489]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                    <span>Smaller</span>
                    <span>Larger</span>
                  </div>
                </div>
              )}

              {/* Embroidery warning for hats and embroidery hoodies */}
              {isEmbroidery && (
                <div className="w-full max-w-sm mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
                  <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
                  <p className="text-xs text-amber-700">
                    <strong>Embroidery tip:</strong> Use a simple logo with <strong>no background</strong> and 5 or fewer colors. Complex images with backgrounds look best with DTG printing.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center mt-3 px-4">
                Live preview — the final mockup will look more realistic.
              </p>
            </>
          ) : (
            <div className="py-8 text-center w-full max-w-sm">
              {/* Color swatch placeholder when no template */}
              <div
                className="w-32 h-32 rounded-2xl mx-auto mb-4 flex items-center justify-center text-5xl shadow-md"
                style={{ backgroundColor: selectedColor?.code || '#e5e7eb' }}
              >
                {selectedProduct?.emoji}
              </div>
              <p className="text-gray-400 text-sm">
                Preview not available — your design will still generate correctly.
              </p>
              {/* Embroidery warning even without template */}
              {isEmbroidery && (
                <div className="mt-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-left flex gap-2">
                  <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
                  <p className="text-xs text-amber-700">
                    <strong>Embroidery tip:</strong> Use a simple logo with <strong>no background</strong> and 5 or fewer colors.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <ErrorBanner message={error} />}

          <button
            onClick={handleGenerate}
            disabled={!designUrl}
            className="w-full max-w-sm mt-6 py-4 bg-[#3eb489] hover:bg-[#359970] text-white font-semibold rounded-2xl transition-colors shadow-md disabled:opacity-40 text-base"
          >
            ✨ Generate Realistic Mockup
          </button>
        </div>
      </PageShell>
    );
  }

  // ─── Step: Generating ─────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-[#3eb489]/10 rounded-full flex items-center justify-center mb-5 animate-pulse">
          <span className="text-4xl">🎨</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/MintedMerchSpinnerLogo.png" alt="Minted Merch" className="h-10 mb-6" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Generating your mockup…</h2>
        <p className="text-sm text-gray-400 text-center">
          Minted Merch is rendering your design onto the {selectedProduct?.label.toLowerCase()}.
          <br />Usually takes 5–15 seconds.
        </p>
        <div className="flex gap-1.5 mt-8">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-[#3eb489] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // ─── Step: Result ─────────────────────────────────────────────────────────
  if (step === 'result') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/MintedMerchHeaderLogo.png" alt="Minted Merch" className="h-8" />
          <h1 className="font-bold text-gray-900">Your Mockup</h1>
        </div>

        <div className="flex flex-col items-center px-4 pt-6 pb-10 flex-1">
          {/* Mockup image */}
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-lg bg-white mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mockupUrl} alt="Your custom mockup" className="w-full h-auto" />
          </div>

          <div className="w-full max-w-sm space-y-3">
            {/* ── Added-to-cart success state ── */}
            {buyAdded ? (
              <div className="w-full rounded-2xl bg-[#3eb489]/10 border border-[#3eb489]/30 px-4 py-4 flex flex-col items-center gap-3">
                <p className="text-[#2a7a5c] font-semibold text-base">Added to Cart! 🛒</p>
                <p className="text-gray-500 text-sm text-center">
                  Your custom {selectedProduct?.label.toLowerCase()} is in your cart. Go back to the shop to checkout.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="w-full py-3 bg-[#3eb489] hover:bg-[#34a078] text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  Go to Shop & Checkout →
                </button>
              </div>
            ) : (
              <>
                {/* Buy button */}
                <button
                  onClick={openBuySheet}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-[#3eb489] hover:bg-[#34a078] text-white font-semibold rounded-2xl transition-colors shadow-md text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Buy This Design
                </button>

                {/* Share button */}
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-semibold rounded-2xl transition-colors shadow-md text-base"
                >
                  <svg className="w-5 h-5" viewBox="0 0 520 457" fill="currentColor">
                    <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                  </svg>
                  Share on Farcaster
                </button>

                {/* Create another */}
                <button
                  onClick={handleReset}
                  className="w-full py-3.5 bg-white border-2 border-gray-200 hover:border-[#3eb489] text-gray-700 font-medium rounded-2xl transition-colors text-base"
                >
                  🎨 Create Another
                </button>

                {/* Back to shop */}
                <button onClick={() => router.push('/')} className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  ← Back to Shop
                </button>
              </>
            )}
          </div>

          {/* ── Size Picker Bottom Sheet ── */}
          {showBuySheet && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
              {/* Backdrop */}
              <div className="absolute inset-0" onClick={() => !buyLoading && setShowBuySheet(false)} />

              {/* Sheet */}
              <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 z-10">
                <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
                <h2 className="font-bold text-gray-900 text-lg mb-1">Select a Size</h2>
                <p className="text-sm text-gray-500 mb-5">
                  {historyMockup
                    ? `Custom ${DESIGN_STUDIO_PRODUCTS.find(p => p.id === historyMockup.product_type)?.label || historyMockup.product_type} · ${historyMockup.color_name || 'Custom Color'}`
                    : `Custom ${selectedProduct?.label} · ${selectedColor?.name || 'Custom Color'} · ${selectedProduct?.techniqueLabel || (selectedTechnique === 'EMBROIDERY' ? 'Embroidery' : 'DTG Print')}`
                  }
                </p>

                {/* Size grid — populated from real Shopify variants */}
                {variantsLoading ? (
                  <div className="flex items-center justify-center py-6 mb-5">
                    <svg className="animate-spin w-6 h-6 text-[#3eb489]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span className="ml-2 text-sm text-gray-500">Loading sizes…</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {(shopifyVariants.length > 0 ? shopifyVariants : (selectedProduct?.sizes || []).map(s => ({ id: s, title: s }))).map(variant => (
                      <button
                        key={variant.id || variant.title}
                        onClick={() => setSelectedSize(variant.title)}
                        className={`py-3 rounded-xl border-2 font-semibold text-sm transition-colors ${
                          selectedSize === variant.title
                            ? 'border-[#3eb489] bg-[#3eb489]/10 text-[#2a7a5c]'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {variant.title}
                      </button>
                    ))}
                  </div>
                )}

                {buyError && (
                  <p className="text-red-500 text-sm mb-3">{buyError}</p>
                )}

                {/* Confirm button */}
                <button
                  onClick={handleBuyConfirm}
                  disabled={buyLoading || !selectedSize}
                  className="w-full py-4 bg-[#3eb489] hover:bg-[#34a078] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-colors text-base flex items-center justify-center gap-2"
                >
                  {buyLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Adding to Cart...
                    </>
                  ) : (() => {
                    const matched = shopifyVariants.find(v => v.title === selectedSize);
                    const price = matched?.price ?? selectedProduct?.displayPrice;
                    return <>Add to Cart{price ? ` — $${parseFloat(price).toFixed(2)}` : ''}</>;
                  })()}
                </button>
              </div>
            </div>
          )}

          {/* Past mockups gallery */}
          {myMockups.length > 1 && (
            <div className="w-full max-w-sm mt-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Past Mockups</h2>
              <div className="grid grid-cols-2 gap-3">
                {myMockups.slice(1, 7).map(m => (
                  <MockupCard
                    key={m.id}
                    mockup={m}
                    onShare={handleShareMockup}
                    onBuy={openBuySheetForMockup}
                    onDelete={handleDeleteMockup}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageShell({ children, onBack, title, step, totalSteps }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0 overflow-hidden">
            <h1 className="font-bold text-gray-900 flex items-center gap-2 truncate">{title}</h1>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{step}/{totalSteps}</span>
        </div>
        <div className="mt-2 h-1 bg-gray-100 rounded-full">
          <div className="h-1 bg-[#3eb489] rounded-full transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="w-full max-w-sm mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
      {message}
    </div>
  );
}

function MockupCard({ mockup, onShare, onBuy, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closeMenu = () => { setMenuOpen(false); setDeleteConfirm(false); };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(mockup);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
      closeMenu();
    }
  };

  return (
    // Outer wrapper without overflow-hidden so the dropdown can escape the card bounds
    <div className="relative">
      {/* The card itself */}
      <div className="rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mockup.mockup_url} alt="Past mockup" className="w-full h-full object-cover" />
        {/* Bottom label */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 rounded-b-xl">
          <p className="text-white text-[10px] font-medium capitalize truncate">
            {mockup.product_type} · {mockup.color_name}
          </p>
        </div>
      </div>

      {/* Three-dot menu button — positioned over card top-right */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); setDeleteConfirm(false); }}
        className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md text-white text-base leading-none hover:bg-black/70 transition-colors"
        title="More options"
      >
        ···
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          {/* Invisible full-screen backdrop to close on outside tap */}
          <div className="fixed inset-0 z-20" onClick={closeMenu} />

          <div className="absolute top-9 right-0 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-44">
            {/* Share */}
            <button
              onClick={() => { closeMenu(); onShare(mockup.mockup_url); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-[#6A3CFF] flex-shrink-0" viewBox="0 0 520 457" fill="currentColor">
                <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
              </svg>
              Share on Farcaster
            </button>

            <div className="h-px bg-gray-100 mx-3" />

            {/* Buy */}
            <button
              onClick={() => { closeMenu(); onBuy(mockup); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-[#3eb489] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Buy This Design
            </button>

            <div className="h-px bg-gray-100 mx-3" />

            {/* Delete — two-step confirmation */}
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            ) : (
              <div className="px-4 py-3 bg-red-50">
                <p className="text-xs text-red-600 font-medium mb-2">Delete this mockup? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-60 transition-colors flex items-center justify-center"
                  >
                    {deleting ? (
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
