'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';
import { DESIGN_STUDIO_PRODUCTS } from '@/lib/designStudioConfig';

export function CreatePageClient() {
  const router = useRouter();
  const { user, getSessionToken, isInFarcaster, getPfpUrl } = useFarcaster();

  // ─── Step state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState('product');

  // Product
  const [selectedProduct, setSelectedProduct] = useState(null);

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

  // Mockup history
  const [myMockups, setMyMockups] = useState([]);
  const [mockupsLoading, setMockupsLoading] = useState(false);

  // Errors
  const [error, setError] = useState('');

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
  const loadTemplate = useCallback(async (product, color) => {
    setTemplateLoading(true);
    setTemplate(null);
    try {
      const variantId = color.variantIds[0];
      const technique = product.technique ? `&technique=${product.technique}` : '';
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
      loadTemplate(selectedProduct, selectedColor); // async, don't await — go to preview immediately
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
    loadTemplate(selectedProduct, selectedColor);
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
  const handleShare = async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop';
    const text = `Check out my custom @mintedmerch design idea 👀\n\nCreate your own in the mini app!\n${appUrl}/create`;
    try {
      if (isInFarcaster) {
        await sdk.actions.composeCast({ text, embeds: [mockupUrl] });
      } else {
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(mockupUrl)}`;
        window.open(warpcastUrl, '_blank');
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // ─── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep('product');
    setSelectedProduct(null);
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
  };

  // =========================================================================
  // ─── Step: Product Picker ─────────────────────────────────────────────────
  if (step === 'product') {
    return (
      <PageShell onBack={() => router.push('/')} title="Design Studio" step={1} totalSteps={4}>
        <div className="flex flex-col items-center px-4 pt-4 pb-8">
          <p className="text-gray-500 text-sm text-center mb-6">
            Pick a product to put your design on
          </p>
          <div className="w-full max-w-sm space-y-3">
            {DESIGN_STUDIO_PRODUCTS.map(product => (
              <button
                key={product.id}
                onClick={() => { setSelectedProduct(product); loadColors(product); setDesignScale(product.defaultScale ?? 0.85); setDesignPlacement('center'); setStep('color'); }}
                className="w-full flex items-center gap-4 bg-white border-2 border-gray-100 hover:border-[#3eb489] active:border-[#3eb489] rounded-2xl px-5 py-4 transition-all text-left shadow-sm"
              >
                <span className="text-4xl">{product.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-lg">{product.label}</p>
                    {product.techniqueLabel && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                        {product.techniqueLabel}
                      </span>
                    )}
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
                  <div key={m.id} className="relative rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.mockup_url} alt="Past mockup" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                      <p className="text-white text-[10px] font-medium capitalize truncate">{m.product_type} · {m.color_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <ErrorBanner message={error} />}
        </div>
      </PageShell>
    );
  }

  // ─── Step: Color Picker ───────────────────────────────────────────────────
  if (step === 'color') {
    return (
      <PageShell onBack={() => setStep('product')} title={`${selectedProduct?.emoji} ${selectedProduct?.label}`} step={2} totalSteps={4}>
        <div className="flex flex-col items-center px-4 pt-4 pb-8">
          <p className="text-gray-500 text-sm text-center mb-6">Choose a color</p>
          {colorsLoading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]" />
              <p className="text-sm text-gray-400">Loading colors…</p>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              <div className="grid grid-cols-5 gap-3">
                {colors.map(color => (
                  <button
                    key={color.name}
                    onClick={() => { setSelectedColor(color); setStep('upload'); }}
                    title={color.name}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div
                      className="w-11 h-11 rounded-full border-2 border-gray-200 group-hover:border-[#3eb489] transition-all shadow-sm"
                      style={{ backgroundColor: color.code }}
                    />
                    <span className="text-[10px] text-gray-500 text-center leading-tight truncate w-full">{color.name}</span>
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
      <PageShell onBack={() => setStep('color')} title="Upload Your Design" step={3} totalSteps={4}>
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

          {/* Profile picture shortcut */}
          {getPfpUrl?.() && (
            <button
              onClick={() => {
                setDesignUrl(getPfpUrl());
                loadTemplate(selectedProduct, selectedColor);
                setStep('preview');
              }}
              className="w-full max-w-sm flex items-center gap-3 bg-white border-2 border-gray-100 hover:border-[#3eb489] rounded-2xl px-4 py-3 transition-all mt-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getPfpUrl()} alt="Your profile" className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />
              <div className="text-left">
                <p className="font-medium text-gray-700 text-sm">Use My Profile Picture</p>
                <p className="text-xs text-gray-400">@{user?.username || 'you'}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
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
    const showPlacementOptions = selectedProduct?.id !== 'hat';

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
      <PageShell onBack={() => setStep('upload')} title="Preview & Generate" step={4} totalSteps={4}>
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
                    min={selectedProduct?.id === 'hat' ? '0.2' : '0.3'}
                    max={selectedProduct?.id === 'hat' ? '0.7' : '1.2'}
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

              {/* Embroidery warning for hats */}
              {selectedProduct?.id === 'hat' && (
                <div className="w-full max-w-sm mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
                  <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
                  <p className="text-xs text-amber-700">
                    <strong>Embroidery tip:</strong> Use a simple logo with <strong>no background</strong> and 5 or fewer colors. Complex images with backgrounds look best on T-shirts.
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
              {selectedProduct?.id === 'hat' && (
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
        <div className="w-20 h-20 bg-[#3eb489]/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <span className="text-4xl">🎨</span>
        </div>
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
            {/* Share button */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#6A3CFF] hover:bg-[#5A2FE6] text-white font-semibold rounded-2xl transition-colors shadow-md text-base"
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
          </div>

          {/* Past mockups gallery */}
          {myMockups.length > 1 && (
            <div className="w-full max-w-sm mt-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Past Mockups</h2>
              <div className="grid grid-cols-2 gap-3">
                {myMockups.slice(1, 7).map(m => (
                  <div key={m.id} className="relative rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.mockup_url} alt="Past mockup" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                      <p className="text-white text-[10px] font-medium capitalize truncate">{m.product_type} · {m.color_name}</p>
                    </div>
                  </div>
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
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{title}</h1>
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
