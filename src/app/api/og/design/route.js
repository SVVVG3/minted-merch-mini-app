import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');

const PRODUCT_LABELS = {
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  hat:    'Hat',
};

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Minted-Merch-OG/1.0' },
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const buffer      = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mockupUrl     = searchParams.get('mockupUrl')     || '';
    const productType   = searchParams.get('productType')   || 'tshirt';
    const colorName     = searchParams.get('colorName')     || '';
    const creatorHandle = searchParams.get('creatorHandle') || '';
    // mogulTier: '' | 'green' | 'gold'
    const mogulTier     = searchParams.get('mogulTier')     || '';

    const productLabel = PRODUCT_LABELS[productType] || (productType.charAt(0).toUpperCase() + productType.slice(1));

    // Badge image URL based on mogulTier
    const badgeUrl = mogulTier === 'gold'
      ? `${BASE_URL}/GoldVerifiedMerchMogulBadge.png`
      : mogulTier === 'green'
      ? `${BASE_URL}/VerifiedMerchMogulBadge.png`
      : null;

    // Fetch all images in parallel
    const [productImageSrc, logoImageSrc, badgeImageSrc] = await Promise.all([
      mockupUrl ? fetchImageAsDataUrl(mockupUrl)              : Promise.resolve(null),
      fetchImageAsDataUrl(`${BASE_URL}/logo.png`),
      badgeUrl  ? fetchImageAsDataUrl(badgeUrl)               : Promise.resolve(null),
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
          {/* Main row — same layout as order OG */}
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
            {/* Mockup image — same dimensions as order OG */}
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
                flexShrink: 0,
              }}
            >
              {productImageSrc ? (
                <img
                  src={productImageSrc}
                  alt="Custom design mockup"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', fontSize: '100px' }}>👕</div>
              )}
            </div>

            {/* Text section — same as order OG */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                maxWidth: '500px',
                flex: 1,
              }}
            >
              {/* Product headline — 56px matching order OG */}
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  marginBottom: '30px',
                  lineHeight: '1.1',
                  color: 'white',
                  display: 'flex',
                }}
              >
                Custom {productLabel}
              </div>

              {/* Designed by row */}
              {creatorHandle && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: badgeImageSrc ? '12px' : '20px',
                    fontSize: '28px',
                    color: '#aaaaaa',
                    gap: '12px',
                  }}
                >
                  <span>Designed by</span>
                  <span style={{ color: '#3eb489', fontWeight: 'bold' }}>{creatorHandle}</span>
                </div>
              )}

              {/* Merch Mogul badge — separate row below "Designed by" */}
              {badgeImageSrc && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '20px',
                  }}
                >
                  <img
                    src={badgeImageSrc}
                    alt="Merch Mogul"
                    style={{ height: '36px', objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* Color */}
              {colorName && (
                <div
                  style={{
                    fontSize: '28px',
                    color: 'white',
                    display: 'flex',
                    lineHeight: '1.3',
                  }}
                >
                  <span style={{ color: '#aaaaaa' }}>Color:&nbsp;</span>
                  <span>{colorName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Logo bottom-right — same as order OG */}
          {logoImageSrc && (
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
                src={logoImageSrc}
                alt="Minted Merch"
                style={{ width: '120px', height: '120px', objectFit: 'contain' }}
              />
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma':         'no-cache',
          'Expires':        '0',
        },
      },
    );

  } catch (error) {
    console.error('OG Design Error:', error);

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <div style={{ fontSize: 100, color: '#3eb489', display: 'flex' }}>👕</div>
          <div style={{ fontSize: 48, marginTop: 20, display: 'flex' }}>Custom Design</div>
          <div style={{ fontSize: 36, color: '#3eb489', marginTop: 20, display: 'flex' }}>Minted Merch</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma':         'no-cache',
          'Expires':        '0',
        },
      },
    );
  }
}
