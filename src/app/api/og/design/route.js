import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');

// Product type ID → display label (matching designStudioConfig.js)
const PRODUCT_LABELS = {
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  hat:    'Hat',
};

async function fetchAsDataUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Minted-Merch-OG/1.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/jpeg';
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mockupUrl     = searchParams.get('mockupUrl') || '';
  const productType   = searchParams.get('productType') || 'tshirt';
  const colorName     = searchParams.get('colorName') || '';
  const creatorHandle = searchParams.get('creatorHandle') || '';
  // mogulTier: '' | 'green' | 'gold'
  const mogulTier     = searchParams.get('mogulTier') || '';

  const productLabel = PRODUCT_LABELS[productType] || (productType.charAt(0).toUpperCase() + productType.slice(1));

  // Badge image path
  const badgePath = mogulTier === 'gold'
    ? `${BASE_URL}/GoldVerifiedMerchMogulBadge.png`
    : mogulTier === 'green'
    ? `${BASE_URL}/VerifiedMerchMogulBadge.png`
    : null;

  // Fetch all images in parallel (same pattern as working order route)
  const [mockupSrc, logoSrc, badgeSrc] = await Promise.all([
    mockupUrl  ? fetchAsDataUrl(mockupUrl)  : Promise.resolve(null),
    fetchAsDataUrl(`${BASE_URL}/logo.png`),
    badgePath  ? fetchAsDataUrl(badgePath)  : Promise.resolve(null),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          backgroundImage: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Main row — identical proportions to order OG */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '80px',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Mockup thumbnail — 450×450 matching order OG */}
          <div
            style={{
              width: '450px',
              height: '450px',
              borderRadius: '24px',
              backgroundColor: '#2a2a2a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #3eb489',
              overflow: 'hidden',
              flexShrink: '0',
            }}
          >
            {mockupSrc ? (
              <img
                src={mockupSrc}
                alt="Custom design"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ display: 'flex', fontSize: '100px' }}>👕</div>
            )}
          </div>

          {/* Text section — max 500px matching order OG */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              maxWidth: '500px',
            }}
          >
            {/* "Designed by" row — above the title */}
            {creatorHandle && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '24px',
                  fontSize: '22px',
                  color: '#888888',
                  gap: '10px',
                }}
              >
                <span>Designed by</span>
                <span style={{ color: '#3eb489', fontWeight: 'bold' }}>{creatorHandle}</span>
                {badgeSrc && (
                  <img
                    src={badgeSrc}
                    alt="Merch Mogul"
                    style={{ height: '28px', objectFit: 'contain' }}
                  />
                )}
              </div>
            )}

            {/* Product headline — 56px matching order OG */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                marginBottom: '20px',
                lineHeight: '1.1',
                color: 'white',
                display: 'flex',
              }}
            >
              Custom {productLabel}
            </div>

            {/* Color */}
            {colorName && (
              <div
                style={{
                  fontSize: '28px',
                  color: '#aaaaaa',
                  display: 'flex',
                  marginBottom: '0px',
                }}
              >
                <span style={{ color: '#888888' }}>Color:&nbsp;</span>
                <span>{colorName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Logo bottom-right — same as order OG */}
        {logoSrc && (
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px',
              width: '160px',
              height: '160px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <img
              src={logoSrc}
              alt="Minted Merch"
              style={{ width: '120px', height: '120px', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
