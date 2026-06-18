import { ImageResponse } from '@vercel/og';

export const runtime = 'nodejs';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');

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
  const productType   = searchParams.get('productType') || 'Design';
  const colorName     = searchParams.get('colorName') || '';
  const creatorHandle = searchParams.get('creatorHandle') || '';
  const isMerchMogul  = searchParams.get('isMerchMogul') === '1';

  const productLabel = productType.charAt(0).toUpperCase() + productType.slice(1);

  const [mockupSrc, logoSrc] = await Promise.all([
    mockupUrl ? fetchAsDataUrl(mockupUrl) : Promise.resolve(null),
    fetchAsDataUrl(`${BASE_URL}/logo.png`),
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
          backgroundColor: '#0a0a0a',
          backgroundImage: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Main row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '72px',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Mockup thumbnail */}
          <div
            style={{
              width: '420px',
              height: '420px',
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
              <div style={{ fontSize: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👕</div>
            )}
          </div>

          {/* Text section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              width: '480px',
            }}
          >
            {/* Creator */}
            {creatorHandle && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '20px',
                  fontSize: '22px',
                  color: '#888888',
                }}
              >
                <span>Designed by&nbsp;</span>
                <span style={{ color: '#3eb489', fontWeight: 'bold' }}>{creatorHandle}</span>
                {isMerchMogul && (
                  <span
                    style={{
                      fontSize: '16px',
                      backgroundColor: '#854d0e',
                      color: '#fef08a',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontWeight: 'bold',
                      marginLeft: '10px',
                    }}
                  >
                    Merch Mogul
                  </span>
                )}
              </div>
            )}

            {/* Headline */}
            <div
              style={{
                fontSize: '52px',
                fontWeight: 'bold',
                lineHeight: '1.1',
                color: 'white',
                marginBottom: '16px',
                display: 'flex',
              }}
            >
              Custom {productLabel}
            </div>

            {colorName && (
              <div style={{ fontSize: '26px', color: '#aaaaaa', marginBottom: '32px', display: 'flex' }}>
                {colorName}
              </div>
            )}

            {/* CTA */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#3eb489',
                color: 'white',
                fontSize: '28px',
                fontWeight: 'bold',
                padding: '16px 32px',
                borderRadius: '16px',
              }}
            >
              Order or Create a Design 🎨
            </div>
          </div>
        </div>

        {/* Logo bottom-right */}
        {logoSrc && (
          <div
            style={{
              position: 'absolute',
              bottom: '28px',
              right: '28px',
              width: '120px',
              height: '120px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.15)',
            }}
          >
            <img
              src={logoSrc}
              alt="Minted Merch"
              style={{ width: '96px', height: '96px', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
