'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';
import { useFarcaster } from '@/lib/useFarcaster';
import { DESIGN_STUDIO_PRODUCTS } from '@/lib/designStudioConfig';
import { useCart } from '@/lib/CartContext';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ProfileModal } from '@/components/ProfileModal';
import { ClaimCreatorEarnings } from '@/components/ClaimCreatorEarnings';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { USDC_CONTRACT, PAYMENT_CONFIG } from '@/lib/usdc';

// ─── EXIF orientation helpers ────────────────────────────────────────────────
// Read the EXIF orientation tag from a JPEG File without a library.
// Returns the raw orientation integer (1 = normal, 3 = 180°, 6 = 90° CW, 8 = 270° CW).
async function readExifOrientation(file) {
  if (!file || !file.type?.startsWith('image/jpeg')) return 1;
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const view = new DataView(e.target.result);
        if (view.getUint16(0, false) !== 0xffd8) { resolve(1); return; }
        let offset = 2;
        while (offset < view.byteLength) {
          const marker = view.getUint16(offset, false);
          offset += 2;
          if (marker === 0xffe1) { // APP1 – EXIF data
            if (view.getUint32(offset + 2, false) !== 0x45786966) { resolve(1); return; }
            const little = view.getUint16(offset + 8, false) === 0x4949;
            const ifdOffset = view.getUint32(offset + 12, little) + offset + 8;
            const entries = view.getUint16(ifdOffset, little);
            for (let i = 0; i < entries; i++) {
              if (view.getUint16(ifdOffset + 2 + 12 * i, little) === 0x0112) {
                resolve(view.getUint16(ifdOffset + 2 + 12 * i + 8, little));
                return;
              }
            }
            resolve(1); return;
          }
          offset += view.getUint16(offset, false);
        }
      } catch { /* ignore parse errors */ }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 65536)); // only first 64 KB needed
  });
}

// Map EXIF orientation to the CSS rotation degrees needed to display correctly
function exifToRotation(exif) {
  if (exif === 3) return 180;
  if (exif === 6) return 90;
  if (exif === 8) return 270;
  return 0;
}

// Convert an animated or static GIF to a static PNG File using canvas.
// Canvas drawImage() always captures the first frame, stripping animation.
async function convertGifToStaticPng(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_DIM = 1500;
      const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round((img.naturalWidth  || 200) * scale);
      canvas.height = Math.round((img.naturalHeight || 200) * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(blob => {
        if (blob) {
          resolve(new File([blob], file.name.replace(/\.gif$/i, '.png'), { type: 'image/png' }));
        } else {
          resolve(file); // fallback: use original if canvas fails
        }
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// Resize + optionally rotate an image File/Blob client-side before upload.
// Caps the longest dimension at MAX_DIM and re-encodes as JPEG to keep
// the payload well under Vercel's 4.5 MB serverless body-size limit.
// Also bakes in EXIF rotation so the crop tool always gets upright pixels.
async function prepareImageForUpload(file, rotationDegrees = 0) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Failed to load image for processing'));
      i.src = objectUrl;
    });

    const MAX_DIM = 1500;
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const drawW = Math.round(img.naturalWidth * scale);
    const drawH = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    if (rotationDegrees === 90 || rotationDegrees === 270) {
      canvas.width = drawH;
      canvas.height = drawW;
    } else {
      canvas.width = drawW;
      canvas.height = drawH;
    }

    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotationDegrees * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    // Preserve transparency for PNG/WebP — JPEG fills alpha with black.
    const supportsAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const mimeType = supportsAlpha ? 'image/png' : 'image/jpeg';
    const quality  = supportsAlpha ? undefined : 0.9;

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('canvas.toBlob returned null')),
        mimeType, quality,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Fetch image via same-origin proxy, rotate using canvas, re-upload to R2.
// Returns the new R2 URL for the rotated design.
// Caps canvas size at 1 500 px to avoid mobile memory limits (portrait photos
// from modern phones can exceed 12 MP which crashes canvas.toBlob on Safari).
async function rotateAndReupload(imageUrl, degrees, sessionToken) {
  // Proxy fetch avoids cross-origin canvas tainting
  const proxyUrl = `/api/design-studio/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const rotatedBlob = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const MAX_DIM = 1500;
        const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        const drawW = Math.round(img.naturalWidth * scale);
        const drawH = Math.round(img.naturalHeight * scale);

        const canvas = document.createElement('canvas');
        // Swap dimensions for 90 / 270 rotations
        if (degrees === 90 || degrees === 270) {
          canvas.width = drawH;
          canvas.height = drawW;
        } else {
          canvas.width = drawW;
          canvas.height = drawH;
        }

        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees * Math.PI) / 180);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

        canvas.toBlob(b => {
          if (b) resolve(b);
          else reject(new Error('canvas.toBlob returned null — image may be too large'));
        }, 'image/jpeg', 0.9);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for rotation'));
    img.src = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);

  const formData = new FormData();
  formData.append('file', rotatedBlob, 'design-rotated.jpg');
  const uploadRes = await fetch('/api/design-studio/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: formData,
  });
  if (!uploadRes.ok) {
    throw new Error(`Upload failed (${uploadRes.status})`);
  }
  const uploadData = await uploadRes.json();
  if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');
  return uploadData.url;
}

export function CreatePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, getSessionToken, isInFarcaster, getPfpUrl } = useFarcaster();
  const { addItem } = useCart();

  // ─── Step state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState('product');

  // ─── Merch Mogul status (50M+ staked) ─────────────────────────────────────
  const [isMerchMogul, setIsMerchMogul] = useState(false);

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
  const [lastPositionData, setLastPositionData] = useState(null);
  const [lastVariantIds, setLastVariantIds] = useState(null);

  // Result
  const [mockupUrl, setMockupUrl] = useState('');
  const [savedMockupId, setSavedMockupId] = useState(null);

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
  // Ensures the auto-advance to 'preview' only fires once per cast prefill.
  // Without this, pressing back would immediately re-advance.
  const castAutoAdvanced = useRef(false);

  // ─── Image rotation ───────────────────────────────────────────────────────
  // 0 | 90 | 180 | 270 — CSS-rotated in preview, applied to design at generate time
  const [rotationDegrees, setRotationDegrees] = useState(0);

  // ─── Profile modal ────────────────────────────────────────────────────────
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // ─── Crop step ────────────────────────────────────────────────────────────
  const [cropMode, setCropMode] = useState('circle'); // 'circle' | 'rect'
  const [crop, setCrop] = useState(null);             // current interactive crop
  const [completedCrop, setCompletedCrop] = useState(null); // committed crop on drag end
  const [isCropping, setIsCropping] = useState(false);
  const cropImgRef = useRef(null);                    // ref on the <img> inside ReactCrop

  // ─── Design position offset (preview step drag-to-reposition) ────────────
  // Offset in preview pixels from the centered default position.
  const [designOffset, setDesignOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  // Stores current print-area + design dims so pointer handlers can clamp without stale closure.
  const printAreaDims = useRef({ paW: 0, paH: 0, sz: 0 });

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

  // ─── Check Merch Mogul status ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.fid) return;
    const token = getSessionToken();
    if (!token) return;
    // Reuse the royalties endpoint — returns 403 if not a Merch Mogul
    fetch('/api/creator/royalties', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.ok) setIsMerchMogul(true); })
      .catch(() => { /* ignore — defaults to false */ });
  }, [user?.fid, getSessionToken]);

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

        // Bake in EXIF orientation correction before Printful sees the image.
        // Browsers auto-correct EXIF in <img> tags (so preview looks fine), but
        // Printful renders raw pixels and ignores EXIF → mockup comes out sideways.
        // GIFs also need flattening — Printful can't process them; canvas gives us the first frame.
        let finalUrl = data.url;
        const castExifOrientation = data.exifOrientation || 1;
        const castAutoRotation = exifToRotation(castExifOrientation);
        if (castAutoRotation !== 0 || data.isGif) {
          console.log(`📐 Cast action image: EXIF orientation ${castExifOrientation} (${castAutoRotation}°)${data.isGif ? ' GIF→flatten' : ''}`);
          try {
            finalUrl = await rotateAndReupload(data.url, castAutoRotation, sessionToken);
            console.log(`✅ Processed cast image: ${finalUrl}`);
          } catch (rotErr) {
            console.warn('Image processing failed, using original (user can rotate manually):', rotErr);
          }
        }

        setDesignUrl(finalUrl);
        setCastImagePrefilled(true);
        console.log(`🎨 Cast image loaded from action: ${finalUrl}`);
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

        // Bake in EXIF orientation correction before Printful sees the image.
        // Browsers auto-correct EXIF in <img> tags (so preview looks fine), but
        // Printful renders raw pixels and ignores EXIF → mockup comes out sideways.
        // GIFs also need flattening — Printful can't process them; canvas gives us the first frame.
        let contextFinalUrl = r2Data.url;
        const contextExifOrientation = r2Data.exifOrientation || 1;
        const contextAutoRotation = exifToRotation(contextExifOrientation);
        if (contextAutoRotation !== 0 || r2Data.isGif) {
          console.log(`📐 Cast context image: EXIF orientation ${contextExifOrientation} (${contextAutoRotation}°)${r2Data.isGif ? ' GIF→flatten' : ''}`);
          try {
            contextFinalUrl = await rotateAndReupload(r2Data.url, contextAutoRotation, sessionToken);
            console.log(`✅ Processed context image: ${contextFinalUrl}`);
          } catch (rotErr) {
            console.warn('Image processing failed, using original (user can rotate manually):', rotErr);
          }
        }

        setDesignUrl(contextFinalUrl);
        setCastImagePrefilled(true);
        console.log(`🎨 Cast image loaded from context: ${contextFinalUrl}`);
      } catch (err) {
        console.error('Cast context image pre-fill error:', err);
      } finally {
        setCastImageLoading(false);
      }
    })();
  // Re-run when auth token becomes available (user might not be authenticated yet on first render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.fid]);

  // For SUBLIMATION products (bandana, pet collar) colors load silently in the background.
  // Auto-select the first color as soon as it arrives so variantIds are available for
  // template preview and mockup generation.
  useEffect(() => {
    if (selectedProduct?.technique === 'SUBLIMATION' && colors.length > 0 && !selectedColor) {
      setSelectedColor(colors[0]);
    }
  }, [selectedProduct, colors, selectedColor]);

  // Auto-advance past the upload step when the cast image is already loaded.
  // castAutoAdvanced ensures we only do this ONCE — pressing back won't re-advance.
  useEffect(() => {
    if (step === 'upload' && castImagePrefilled && designUrl && !castAutoAdvanced.current) {
      castAutoAdvanced.current = true;
      // Kick off template load now so it's ready by the time the user finishes cropping
      loadTemplate(selectedProduct, selectedColor, selectedTechnique);
      setStep('remove-bg');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        designUrl: designUrl || null,
        printfulVariantIds: lastVariantIds || selectedColor?.variantIds || null,
        positionData: lastPositionData || null,
        placement: designPlacement || selectedProduct?.placement || null,
        designScale: designScale || null,
        technique: selectedTechnique || selectedProduct?.technique || null,
      }),
    })
      .then(r => r.json())
      .then(data => { if (data.id) setSavedMockupId(data.id); loadMyMockups(); })
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
      const variantId = color?.variantIds?.[0]; // may be undefined for SUBLIMATION products before auto-select
      const rawTechnique = techniqueOverride || product.technique;
      // Printful only accepts 'EMBROIDERY' as a technique override; DTG is the default
      const effectiveTechnique = (rawTechnique === 'DTG' || rawTechnique === 'SUBLIMATION') ? null : rawTechnique;
      const techniqueParam = effectiveTechnique ? `&technique=${effectiveTechnique}` : '';
      const variantParam   = variantId ? `?variantId=${variantId}${techniqueParam}` : `?${techniqueParam.replace(/^&/, '')}`;
      console.log(`🔍 Loading template for product ${product.printfulProductId}, variantId ${variantId ?? '(none)'}`);
      const res = await fetch(
        `/api/design-studio/templates/${product.printfulProductId}${variantParam}`
      );
      const data = await res.json();
      if (data.template) {
        console.log('✅ Template loaded:', data.template.template_id, `${data.template.template_width}×${data.template.template_height}`);
        setTemplate(data.template);
      } else if (Array.isArray(data.templates) && data.templates.length > 0) {
        // No variantId provided — use first available template (SUBLIMATION fallback)
        console.log('✅ Template loaded (fallback):', data.templates[0].template_id);
        setTemplate(data.templates[0]);
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

    // GIFs don't work on Printful mockups — flatten to a static PNG frame first
    if (file.type === 'image/gif') {
      file = await convertGifToStaticPng(file);
    }

    // Detect EXIF orientation so we can bake in the correction during compression.
    const exifOrientation = await readExifOrientation(file);
    const autoRotation = exifToRotation(exifOrientation);
    try {
      // Resize to ≤1500 px and bake in EXIF rotation in a single canvas pass.
      // This keeps the upload well under Vercel's 4.5 MB body limit (phone photos
      // can be 4–12 MB) and ensures the crop tool always gets upright pixels.
      setError('Preparing image…');
      const processedBlob = await prepareImageForUpload(file, autoRotation);
      setError('');

      const supportsAlpha = file.type === 'image/png' || file.type === 'image/webp';
      const formData = new FormData();
      formData.append('file', processedBlob, supportsAlpha ? 'design.png' : 'design.jpg');
      const res = await fetch('/api/design-studio/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: formData,
      });
      if (!res.ok) {
        throw new Error(res.status === 413
          ? 'Image is too large — please try a smaller image.'
          : `Server error (${res.status})`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');

      setDesignUrl(data.url);
      setRotationDegrees(0); // rotation already baked in by prepareImageForUpload
      loadTemplate(selectedProduct, selectedColor, selectedTechnique); // async, don't await
      setStep('remove-bg');
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
    setStep('remove-bg');
  };

  // ─── Generate mockup ──────────────────────────────────────────────────────
  // Position is always computed server-side from Printful printfile coordinates.
  // We only send designScale and designPlacement so the server can calculate it.
  const handleGenerate = async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) { setError('Please sign in to generate a mockup.'); return; }
    setError('');

    try {
      // Apply rotation BEFORE entering the generating step so that any failure
      // is visible on the preview screen rather than silently ignored.
      let effectiveDesignUrl = designUrl;
      if (rotationDegrees !== 0) {
        setError('Applying rotation…');
        effectiveDesignUrl = await rotateAndReupload(designUrl, rotationDegrees, sessionToken);
        setDesignUrl(effectiveDesignUrl); // bake in — future re-generates use the corrected URL
        setRotationDegrees(0);
        setError('');
      }

      setStep('generating'); // only switch to spinner once prep is done

      const res = await fetch('/api/design-studio/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          productId: selectedProduct.id,
          variantIds: (selectedColor?.variantIds || []).slice(0, 3),
          imageUrl: effectiveDesignUrl,
          designScale,
          designPlacement,
          technique: selectedTechnique || selectedProduct.technique || null,
          // Normalized drag offset: fraction of print-area dims, 0 = centered.
          // Only relevant for center placement; server ignores for leftchest.
          designOffsetX: printAreaDims.current.paW > 0 ? designOffset.x / printAreaDims.current.paW : 0,
          designOffsetY: printAreaDims.current.paH > 0 ? designOffset.y / printAreaDims.current.paH : 0,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to start generation');
      setTaskKey(data.taskKey);
      setPollCount(0);
      if (data.positionData) setLastPositionData(data.positionData);
      if (data.variantIds) setLastVariantIds(data.variantIds);
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

  // Reset drag offset whenever the user switches placement (Full Front ↔ Left Chest)
  // so the new placement always starts from its default centered/fixed position.
  useEffect(() => { setDesignOffset({ x: 0, y: 0 }); }, [designPlacement]);

  // ─── Share on Farcaster ───────────────────────────────────────────────────
  // When sharing the current result screen, use the /design/[id] deep link so
  // other users can tap the embed and buy that exact design.
  // When sharing a past mockup from the gallery we also have its ID via m.id.
  const shareToFarcaster = async (mockupImageUrl, mockupDbId) => {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
    const deepLink = mockupDbId ? `${appUrl}/design/${mockupDbId}` : mockupImageUrl;
    const text = `Check out my custom @mintedmerch design 👀\n\nBuy it or create your own 👇`;
    if (isInFarcaster) {
      await sdk.actions.composeCast({ text, embeds: [deepLink] });
    } else {
      window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(deepLink)}`, '_blank');
    }
  };

  const handleShare = async () => {
    try { await shareToFarcaster(mockupUrl, savedMockupId); } catch (err) { console.error('Share error:', err); }
  };

  const handleShareMockup = async (url, mockupDbId) => {
    try { await shareToFarcaster(url, mockupDbId); } catch (err) { console.error('Share error:', err); }
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
    setSavedMockupId(null);
    setError('');
    setBuyAdded(false);
    setBuyError('');
    setSelectedSize('');
    setShopifyVariants([]);
    setHistoryMockup(null);
    setCastImagePrefilled(false);
    castImageProcessed.current = false;
    castAutoAdvanced.current = false;
    setRotationDegrees(0);
    setCrop(null);
    setCompletedCrop(null);
    setCropMode('circle');
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
      const effectiveDesignUrl = historyMockup ? (historyMockup.design_url || designUrl) : designUrl;
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
          printfulVariantIds: historyMockup
            ? (historyMockup.printful_variant_ids || null)
            : (lastVariantIds || selectedColor?.variantIds || null),
          positionData: historyMockup
            ? (historyMockup.position_data || null)
            : (lastPositionData || null),
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
      if (historyMockup) {
        // Buying from the gallery — go home and auto-open the cart
        setHistoryMockup(null);
        router.push('/?openCart=1');
      } else {
        setBuyAdded(true); // Show success state on the current result screen
      }

    } catch (err) {
      console.error('Buy error:', err);
      setBuyError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBuyLoading(false);
    }
  };

  // =========================================================================
  // ─── Dynamic step numbering ───────────────────────────────────────────────
  // Hoodies: product, technique, color, upload, remove-bg, crop, preview (7)
  // All-over print (SUBLIMATION): product, upload, remove-bg, crop, preview (5) — no color step
  // Others: product, color, upload, remove-bg, crop, preview (6)
  const isSublimation = selectedProduct?.technique === 'SUBLIMATION';
  const totalSteps = selectedProduct?.techniqueOptions ? 7 : (isSublimation ? 5 : 6);
  const stepNum = (s) => {
    if (selectedProduct?.techniqueOptions) {
      return { product: 1, technique: 2, color: 3, upload: 4, 'remove-bg': 5, crop: 6, preview: 7 }[s] ?? 1;
    }
    if (isSublimation) {
      return { product: 1, upload: 2, 'remove-bg': 3, crop: 4, preview: 5 }[s] ?? 1;
    }
    return { product: 1, color: 2, upload: 3, 'remove-bg': 4, crop: 5, preview: 6 }[s] ?? 1;
  };

  // ─── Step: Product Picker ─────────────────────────────────────────────────
  if (step === 'product') {
    const designStudioTitle = (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src="/MintedMerchDesignStudio.png" alt="Minted Merch Design Studio" className="h-9 w-auto" />
    );
    const profileButton = user?.pfpUrl ? (
      <button
        onClick={() => setIsProfileModalOpen(true)}
        className="flex-shrink-0 w-11 h-11 rounded-full overflow-hidden border-2 border-[#3eb489] hover:opacity-90 transition-opacity"
        title="Profile"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.pfpUrl} alt="Profile" className="w-full h-full object-cover" />
      </button>
    ) : null;

    return (
      <>
      <PageShell onBack={() => router.push('/')} title={designStudioTitle} showProgress={false} rightExtra={profileButton}>
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
          {/* Claim Creator Earnings — shown to Merch Moguls with pending royalties */}
          {user?.fid && (
            <div className="w-full max-w-sm mb-4">
              <ClaimCreatorEarnings getSessionToken={getSessionToken} />
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
                  } else if (product.technique === 'SUBLIMATION') {
                    // All-over print — no color selection UI, go straight to upload.
                    // Load colors silently in the background so we get a variantId for
                    // template preview and mockup generation.
                    loadColors(product);
                    setStep('upload');
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
                {myMockups.map(m => (
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

      {/* Profile modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

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
            {(() => {
              const currentProduct = historyMockup
                ? DESIGN_STUDIO_PRODUCTS.find(p => p.id === historyMockup.product_type)
                : selectedProduct;
              return currentProduct?.sizeNote ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  {currentProduct.sizeNote}
                </p>
              ) : null;
            })()}
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
      <PageShell onBack={() => setStep('product')} title={selectedProduct?.label} step={stepNum('technique')} totalSteps={totalSteps}>
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
                  Direct-To-Garment. Full color, photo-quality print. Best for detailed artwork, gradients, and photos. Infinite colors.
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
      <PageShell onBack={() => setStep(isSublimation ? 'product' : 'color')} title="Upload Your Design" step={stepNum('upload')} totalSteps={totalSteps}>
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
                  // Flatten GIFs and correct EXIF orientation so Printful gets a clean static image
                  let pfpUrl = data.url;
                  const pfpRotation = exifToRotation(data.exifOrientation || 1);
                  if (pfpRotation !== 0 || data.isGif) {
                    try { pfpUrl = await rotateAndReupload(data.url, pfpRotation, sessionToken); }
                    catch { /* non-fatal — fall back to original */ }
                  }
                  setDesignUrl(pfpUrl);
                  loadTemplate(selectedProduct, selectedColor, selectedTechnique);
                  setStep('remove-bg');
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

          {/* Design style reminder */}
          {(() => {
            const isEmb = selectedProduct?.techniqueOptions
              ? selectedTechnique === 'EMBROIDERY'
              : selectedProduct?.technique === 'EMBROIDERY';
            const isSub = selectedProduct?.technique === 'SUBLIMATION';
            // All-over synthetic (bandana) vs sublimation (pet collar) share the same technique value
            // but bandana uses all-over cut-and-sew while pet collar uses heat transfer sublimation.
            const isAllOverSynthetic = selectedProduct?.id === 'bandana';
            let icon, title, desc;
            if (isEmb) {
              icon = '🧵'; title = 'Embroidery';
              desc = 'Best for simple logos with 5 or fewer colors. No photo backgrounds.';
            } else if (isSub && isAllOverSynthetic) {
              icon = '✂️'; title = 'All-Over Synthetic';
              desc = 'The fabric is printed with your custom design, then cut and sewn to create a unique, hand-made product.';
            } else if (isSub) {
              icon = '🌡️'; title = 'Sublimation';
              desc = 'Design is printed with dye ink on paper and then transferred directly onto the product with heat.';
            } else {
              icon = '🖨️'; title = 'DTG Print';
              desc = 'Direct-To-Garment. Full color, photo-quality. Best for detailed artwork, gradients, and photos.';
            }
            return (
              <div className="w-full max-w-sm mt-4 flex items-start gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            );
          })()}

          {error && <ErrorBanner message={error} />}
        </div>
      </PageShell>
    );
  }

  // ─── Step: Crop ───────────────────────────────────────────────────────────
  // ─── Step: Remove Background (Merch Mogul exclusive) ─────────────────────
  if (step === 'remove-bg') {
    return <RemoveBgStep
      designUrl={designUrl}
      setDesignUrl={setDesignUrl}
      getSessionToken={getSessionToken}
      onDone={() => setStep('crop')}
      onBack={() => setStep('upload')}
      stepNum={stepNum('remove-bg')}
      totalSteps={totalSteps}
      isMerchMogul={isMerchMogul}
    />;
  }

  if (step === 'crop') {
    // Apply the interactive crop to the image using the canvas API, then re-upload to R2.
    const applyCrop = async () => {
      if (!completedCrop || !cropImgRef.current) return;
      setIsCropping(true);
      setError('');
      try {
        // Use the displayed <img> dimensions for coordinate scaling, but fetch
        // the actual pixels via same-origin proxy to avoid tainted-canvas errors
        // (R2 images are cross-origin and block canvas.toBlob without CORS).
        const displayW = cropImgRef.current.width;
        const displayH = cropImgRef.current.height;

        const proxyRes = await fetch(
          `/api/design-studio/proxy-image?url=${encodeURIComponent(designUrl)}`
        );
        if (!proxyRes.ok) throw new Error(`Proxy fetch failed: ${proxyRes.status}`);
        const proxyBlob = await proxyRes.blob();
        const objectUrl = URL.createObjectURL(proxyBlob);

        const img = await new Promise((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = () => reject(new Error('Failed to load image for crop'));
          i.src = objectUrl;
        });

        const scaleX = img.naturalWidth  / displayW;
        const scaleY = img.naturalHeight / displayH;

        const srcX  = completedCrop.x * scaleX;
        const srcY  = completedCrop.y * scaleY;
        const srcW  = completedCrop.width  * scaleX;
        const srcH  = completedCrop.height * scaleY;

        // Cap output at 1 500 px to stay within mobile canvas memory limits
        const MAX_DIM = 1500;
        const scale  = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
        const outW   = Math.round(srcW * scale);
        const outH   = Math.round(srcH * scale);

        const canvas = document.createElement('canvas');
        canvas.width  = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');

        if (cropMode === 'circle') {
          // Clip to circle, transparent background → export as PNG
          ctx.beginPath();
          ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
          ctx.clip();
        }

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        URL.revokeObjectURL(objectUrl);

        const mimeType = cropMode === 'circle' ? 'image/png' : 'image/jpeg';
        const ext      = cropMode === 'circle' ? 'png' : 'jpg';
        const quality  = cropMode === 'circle' ? 1 : 0.92;

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob returned null')), mimeType, quality);
        });

        const sessionToken = getSessionToken();
        const formData = new FormData();
        formData.append('file', blob, `design-cropped.${ext}`);
        const uploadRes = await fetch('/api/design-studio/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');

        setDesignUrl(uploadData.url);
        setRotationDegrees(0); // canvas already baked in orientation — reset CSS rotation
        // Reload template with updated image (template data itself doesn't change, but
        // this ensures preview is re-rendered cleanly)
        loadTemplate(selectedProduct, selectedColor, selectedTechnique);
        setStep('preview');
      } catch (err) {
        setError(`Crop failed: ${err.message}`);
      } finally {
        setIsCropping(false);
      }
    };

    // Compute a sensible initial crop centered on the image.
    // Circle: large centered square (so the circle fills most of the image).
    // Rect: near-full-image coverage leaving a small margin.
    const getInitialCrop = (mode) => {
      const img = cropImgRef.current;
      if (!img || !img.width) {
        // Fallback before image loads — percentage-based
        return mode === 'circle'
          ? { unit: '%', x: 10, y: 10, width: 80, height: 80 }
          : { unit: '%', x: 5,  y: 5,  width: 90, height: 90 };
      }
      const { width, height } = img; // displayed dimensions
      if (mode === 'circle') {
        const size = Math.round(Math.min(width, height) * 0.82);
        return { unit: 'px', x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), width: size, height: size };
      }
      return {
        unit: 'px',
        x: Math.round(width  * 0.05),
        y: Math.round(height * 0.05),
        width:  Math.round(width  * 0.9),
        height: Math.round(height * 0.9),
      };
    };

    const handleCropImgLoad = () => {
      const initCrop = getInitialCrop(cropMode);
      setCrop(initCrop);
      setCompletedCrop(initCrop);
    };

    return (
      <PageShell
        onBack={() => {
          setCastImagePrefilled(false); // prevent cast auto-advance re-triggering
          setCrop(null);
          setCompletedCrop(null);
          setStep('upload');
        }}
        title="Edit Your Design"
        step={stepNum('crop')}
        totalSteps={totalSteps}
      >
        <div className="flex flex-col items-center px-4 pt-4 pb-8">

          {/* Circle / Rectangle toggle */}
          <div className="flex items-center gap-2 mb-4 bg-gray-100 rounded-xl p-1 w-full max-w-xs">
            <button
              onClick={() => {
                setCropMode('circle');
                const initCrop = getInitialCrop('circle');
                setCrop(initCrop);
                setCompletedCrop(initCrop);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                cropMode === 'circle'
                  ? 'bg-white shadow text-gray-800'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
              </svg>
              Circle
            </button>
            <button
              onClick={() => {
                setCropMode('rect');
                const initCrop = getInitialCrop('rect');
                setCrop(initCrop);
                setCompletedCrop(initCrop);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                cropMode === 'rect'
                  ? 'bg-white shadow text-gray-800'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              Rectangle
            </button>
          </div>

          {/* Crop canvas */}
          <div className="w-full max-w-xs rounded-2xl overflow-hidden bg-gray-100">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              circularCrop={cropMode === 'circle'}
              aspect={cropMode === 'circle' ? 1 : undefined}
              className="w-full"
              keepSelection
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={cropImgRef}
                src={designUrl}
                alt="Crop preview"
                className="w-full object-contain"
                style={{ transform: rotationDegrees ? `rotate(${rotationDegrees}deg)` : undefined, maxHeight: '60vh' }}
                onLoad={handleCropImgLoad}
              />
            </ReactCrop>
          </div>

          <p className="text-xs text-gray-400 mt-2 mb-5">
            Drag to reposition · handles to resize
          </p>

          {error && <ErrorBanner message={error} />}

          {/* Apply button */}
          <button
            onClick={applyCrop}
            disabled={!completedCrop || isCropping}
            className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white transition-all
              bg-[#3eb489] hover:bg-[#359970] active:scale-[0.98] disabled:opacity-40"
          >
            {isCropping
              ? <span className="flex items-center justify-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Applying…</span>
              : '✂️ Apply Crop'}
          </button>

          {/* Skip button */}
          <button
            onClick={() => {
              loadTemplate(selectedProduct, selectedColor, selectedTechnique);
              setStep('preview');
            }}
            className="mt-3 w-full max-w-xs py-3 rounded-2xl text-sm text-gray-500 hover:text-gray-700 transition-colors border border-gray-200 hover:border-gray-300"
          >
            Skip — use full image
          </button>
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
    let printAreaBox = null; // for the visible outline
    if (template) {
      const paTop = Math.round(template.print_area_top * displayRatio);
      const paLeft = Math.round(template.print_area_left * displayRatio);
      const paW = Math.round(template.print_area_width * displayRatio);
      const paH = Math.round(template.print_area_height * displayRatio);
      printAreaBox = { top: paTop, left: paLeft, width: paW, height: paH };

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
        // Centered — keep square, scaled off shorter axis; apply drag offset
        const shorter = Math.min(paW, paH);
        const sz = Math.round(shorter * designScale);
        // Clamp offset so design stays fully within the print area
        const maxX = Math.max(0, (paW - sz) / 2);
        const maxY = Math.max(0, (paH - sz) / 2);
        const ox = Math.max(-maxX, Math.min(maxX, designOffset.x));
        const oy = Math.max(-maxY, Math.min(maxY, designOffset.y));
        // Keep printAreaDims ref up-to-date for pointer handlers
        printAreaDims.current = { paW, paH, sz };
        previewDesign = {
          top:  paTop  + Math.round((paH - sz) / 2) + oy,
          left: paLeft + Math.round((paW - sz) / 2) + ox,
          width: sz,
          height: sz,
        };
      }
    }

    return (
      <PageShell
        onBack={() => setStep('crop')}
        title="Preview & Generate"
        step={stepNum('preview')}
        totalSteps={totalSteps}
      >
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

                {/* Print area outline — visible guide for drag repositioning */}
                {printAreaBox && designPlacement === 'center' && (
                  <div
                    className="absolute pointer-events-none rounded"
                    style={{
                      top: printAreaBox.top,
                      left: printAreaBox.left,
                      width: printAreaBox.width,
                      height: printAreaBox.height,
                      border: '1.5px dashed rgba(62,180,137,0.45)',
                    }}
                  />
                )}

                {/* User's design overlaid on the print area — draggable for Full Front */}
                {previewDesign && (
                  <div
                    className="absolute select-none"
                    style={{
                      top: previewDesign.top,
                      left: previewDesign.left,
                      width: previewDesign.width,
                      height: previewDesign.height,
                      cursor: designPlacement === 'center' ? (isDragging.current ? 'grabbing' : 'grab') : 'default',
                      touchAction: 'none',
                    }}
                    onPointerDown={(e) => {
                      if (designPlacement !== 'center') return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      isDragging.current = true;
                      dragStart.current = { x: e.clientX, y: e.clientY, ox: designOffset.x, oy: designOffset.y };
                    }}
                    onPointerMove={(e) => {
                      if (!isDragging.current) return;
                      const { paW, paH, sz } = printAreaDims.current;
                      const maxX = Math.max(0, (paW - sz) / 2);
                      const maxY = Math.max(0, (paH - sz) / 2);
                      setDesignOffset({
                        x: Math.max(-maxX, Math.min(maxX, dragStart.current.ox + (e.clientX - dragStart.current.x))),
                        y: Math.max(-maxY, Math.min(maxY, dragStart.current.oy + (e.clientY - dragStart.current.y))),
                      });
                    }}
                    onPointerUp={() => { isDragging.current = false; }}
                    onPointerCancel={() => { isDragging.current = false; }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={designUrl}
                      alt="Your design"
                      className="w-full h-full object-contain transition-transform duration-300 pointer-events-none"
                      style={{ transform: `rotate(${rotationDegrees}deg)` }}
                    />
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

              {/* Drag hint — only for Full Front where dragging is enabled */}
              {designPlacement === 'center' && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  {(designOffset.x !== 0 || designOffset.y !== 0)
                    ? '↕ Position adjusted — drag to fine-tune'
                    : '✦ Drag the design to reposition it'}
                </p>
              )}

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
                    max={isEmbroidery ? '0.7' : '1.0'}
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

              {/* Rotate button */}
              <button
                onClick={() => setRotationDegrees(d => (d + 90) % 360)}
                className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all shadow-sm ${
                  rotationDegrees !== 0
                    ? 'bg-[#3eb489]/10 border-[#3eb489] text-[#3eb489]'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#3eb489] hover:text-[#3eb489]'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rotate 90°{rotationDegrees !== 0 && ` (${rotationDegrees}° applied)`}
              </button>

              <p className="text-xs text-gray-400 text-center mt-2 px-4">
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
              {/* Rotate button even without template */}
              <button
                onClick={() => setRotationDegrees(d => (d + 90) % 360)}
                className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all shadow-sm ${
                  rotationDegrees !== 0
                    ? 'bg-[#3eb489]/10 border-[#3eb489] text-[#3eb489]'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#3eb489] hover:text-[#3eb489]'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rotate 90°{rotationDegrees !== 0 && ` (${rotationDegrees}° applied)`}
              </button>
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
          Minted Merch is rendering your design onto the {selectedProduct?.label.toLowerCase()}. Usually takes 5–15 seconds.
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
                  onClick={() => router.push('/?openCart=1')}
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
                {myMockups.slice(1).map(m => (
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

function PageShell({ children, onBack, title, step, totalSteps, rightExtra, showProgress = true }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-center overflow-hidden">
            <h1 className="font-bold text-gray-900 flex items-center gap-2 truncate">{title}</h1>
          </div>
          {showProgress && (
            <span className="text-xs text-gray-400 flex-shrink-0">{step}/{totalSteps}</span>
          )}
          {rightExtra}
        </div>
        {showProgress && (
          <div className="mt-2 h-1 bg-gray-100 rounded-full">
            <div className="h-1 bg-[#3eb489] rounded-full transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
        )}
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

// ─── Remove Background Step (Merch Mogul exclusive) ──────────────────────────
function RemoveBgStep({ designUrl, setDesignUrl, getSessionToken, onDone, onBack, stepNum, totalSteps, isMerchMogul }) {
  const [removing,     setRemoving]     = useState(false);
  const [error,        setError]        = useState('');
  const [done,         setDone]         = useState(false);
  const [paymentDone,  setPaymentDone]  = useState(false); // track if tx already submitted

  // Wagmi hooks for paid USDC payment (non-Moguls)
  const { writeContract, data: txHash, isPending: isTxPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const callRemoveApi = async (transactionHash) => {
    setError('');
    setRemoving(true);
    try {
      const token = getSessionToken();
      if (!token) throw new Error('Please sign in first.');
      const res  = await fetch('/api/design-studio/remove-background', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ designUrl, ...(transactionHash && { transactionHash }) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Background removal failed.');
      setDesignUrl(data.url);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  // For Moguls: direct API call (free)
  const handleRemoveFree = () => callRemoveApi(null);

  // For non-Moguls: initiate $0.25 USDC payment first
  const handlePayAndRemove = () => {
    setError('');
    writeContract({
      address:      USDC_CONTRACT.address,
      abi:          USDC_CONTRACT.abi,
      functionName: 'transfer',
      args:         [PAYMENT_CONFIG.merchantWallet, BigInt(250000)], // $0.25 USDC (6 decimals)
    });
  };

  // When payment confirms on-chain, trigger background removal
  useEffect(() => {
    if (isConfirmed && txHash && !paymentDone) {
      setPaymentDone(true);
      callRemoveApi(txHash);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, txHash]);

  // Surface wagmi write errors
  useEffect(() => {
    if (writeError) setError(writeError.shortMessage || writeError.message || 'Transaction failed.');
  }, [writeError]);

  const isBusy = removing || isTxPending || isConfirming;

  const statusText = () => {
    if (isTxPending)   return 'Waiting for wallet confirmation…';
    if (isConfirming)  return 'Confirming payment on-chain…';
    if (removing)      return 'Removing background…';
    return null;
  };

  return (
    <PageShell onBack={onBack} title="Remove Background" step={stepNum} totalSteps={totalSteps}>
      <div className="flex flex-col items-center px-4 pb-10 gap-4">
        {/* Badge row */}
        <div className="flex items-center gap-2 mt-2">
          {isMerchMogul ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/VerifiedMerchMogulBadge.png" alt="Merch Mogul" className="h-5" />
              <span className="text-xs font-semibold text-[#3eb489]">Free for Merch Moguls</span>
            </>
          ) : (
            <span className="text-xs font-semibold text-gray-500">
              ✨ AI-powered background removal — <span className="text-[#3eb489]">free for Merch Moguls</span>
            </span>
          )}
        </div>

        {/* Preview */}
        <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
             style={{ backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%)', backgroundSize: '20px 20px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={designUrl} alt="Your design" className="w-full max-h-72 object-contain" />
        </div>

        <p className="text-sm text-gray-500 text-center max-w-xs">
          {done
            ? '✅ Background removed! Proceed to crop and position your design.'
            : 'Automatically remove the background from your design using AI — best for artwork on a solid or simple background.'}
        </p>

        {statusText() && (
          <div className="flex items-center gap-2 text-sm text-[#3eb489]">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3eb489]" />
            {statusText()}
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        {/* Primary action */}
        {!done && (
          <button
            onClick={isMerchMogul ? handleRemoveFree : handlePayAndRemove}
            disabled={isBusy}
            className="w-full max-w-sm flex items-center justify-center gap-2 py-3.5 bg-[#3eb489] hover:bg-[#35a07a] disabled:opacity-60 text-white font-semibold rounded-2xl transition-colors shadow-md text-base"
          >
            {isBusy ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : isMerchMogul ? (
              '✨ Remove Background'
            ) : (
              '✨ Remove Background — $0.25 USDC'
            )}
          </button>
        )}

        <button
          onClick={onDone}
          disabled={isBusy}
          className={`w-full max-w-sm py-3.5 font-semibold rounded-2xl transition-colors text-base ${
            done
              ? 'bg-[#3eb489] text-white hover:bg-[#35a07a] shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50'
          }`}
        >
          {done ? 'Continue to Crop →' : 'Skip — keep background'}
        </button>
      </div>
    </PageShell>
  );
}

function MockupCard({ mockup, onShare, onBuy, onDelete }) {
  const [menuOpen, setMenuOpen]         = useState(false);
  const [showShareSub, setShowShareSub] = useState(false); // share sub-panel
  const [copied, setCopied]             = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]         = useState(false);

  const appUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL)
    || 'https://app.mintedmerch.shop';

  // Build the deep-link URL for this mockup so viewers can tap straight to the buy page
  const designDeepLink = mockup.id ? `${appUrl}/design/${mockup.id}` : mockup.mockup_url;
  const shareText = `Check out my custom @mintedmerch design 👀\n\nBuy it or create your own 👇\n${designDeepLink}`;

  const closeMenu = () => {
    setMenuOpen(false);
    setDeleteConfirm(false);
    setShowShareSub(false);
    setCopied(false);
  };

  const handleCopyCastText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => { setCopied(false); closeMenu(); }, 1500);
    } catch { /* ignore clipboard errors */ }
  };

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
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 rounded-b-xl flex items-end justify-between gap-1">
          <p className="text-white text-[10px] font-medium capitalize truncate">
            {mockup.product_type} · {mockup.color_name}
          </p>
          {mockup.order_count > 0 && (
            <span className="flex-shrink-0 text-[9px] font-semibold bg-[#3eb489] text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {mockup.order_count} {mockup.order_count === 1 ? 'Order' : 'Orders'}
            </span>
          )}
        </div>
      </div>

      {/* Three-dot menu button — positioned over card top-right */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); setDeleteConfirm(false); setShowShareSub(false); }}
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

          <div className="absolute top-9 right-0 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-48">

            {showShareSub ? (
              /* ── Share sub-panel ─────────────────────────────── */
              <>
                {/* Back row */}
                <button
                  onClick={() => setShowShareSub(false)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <div className="h-px bg-gray-100 mx-3" />

                {/* Copy cast text */}
                <button
                  onClick={handleCopyCastText}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-600 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-gray-700">Copy cast text</span>
                    </>
                  )}
                </button>

                <div className="h-px bg-gray-100 mx-3" />

                {/* Cast on Farcaster */}
                <button
                  onClick={() => { closeMenu(); onShare(mockup.mockup_url, mockup.id); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-[#6A3CFF] flex-shrink-0" viewBox="0 0 520 457" fill="currentColor">
                    <path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/>
                  </svg>
                  Cast on Farcaster
                </button>
              </>
            ) : (
              /* ── Main menu ───────────────────────────────────── */
              <>
                {/* Share — opens sub-panel */}
                <button
                  onClick={() => setShowShareSub(true)}
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
