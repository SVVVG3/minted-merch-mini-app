import { ImageResponse } from '@vercel/og';

// Use Node.js runtime for ImageResponse compatibility
export const runtime = 'nodejs';

// Disable caching during development/testing
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

/**
 * Dynamic OG Image Generator for NFT Mint Pages
 * Layout: NFT artwork (left) + Text overlay (right) + Logo (bottom right)
 * Similar to product/collection share images
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || '';
    const imageUrl = searchParams.get('image');
    const text = searchParams.get('text') || 'Mint NFT';
    
    // Fetch and convert NFT artwork
    let nftImageSrc = null;
    if (imageUrl) {
      // Handle relative URLs
      const fullImageUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}${imageUrl}`;
      
      nftImageSrc = await fetchImageAsDataUrl(fullImageUrl);
    }
    
    // Fetch logo image
    const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(logoUrl);
    } catch (error) {
      console.error('Error fetching logo:', error);
    }
    
    const response = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Main Content Container */}
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
            {/* NFT Artwork Section (LEFT SIDE) */}
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
              {nftImageSrc ? (
                <img
                  src={nftImageSrc}
                  alt="NFT"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div style={{ fontSize: '120px', color: '#3eb489' }}>🎨</div>
              )}
            </div>
            
            {/* Text Section (RIGHT SIDE) */}
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
              {/* Main Text - Centered Vertically on Right */}
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  lineHeight: '1.2',
                  color: '#3eb489',
                }}
              >
                {text}
              </div>
            </div>
          </div>
          
          {/* Logo - Bottom Right Corner with Green Border */}
          {logoImageSrc && (
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                right: '30px',
                width: '160px',
                height: '160px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #3eb489',
                borderRadius: '12px',
                backgroundColor: 'rgba(62, 180, 137, 0.1)',
              }}
            >
              <img
                src={logoImageSrc}
                alt="Minted Merch Logo"
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio required by Farcaster
      }
    );
    
    // Set cache headers to prevent stale images
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    
    return response;
  } catch (error) {
    console.error('Error generating mint OG image:', error);
    
    // Return a fallback error image
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
            color: 'white',
            fontSize: '48px',
          }}
        >
          Failed to generate image
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio required by Farcaster
      }
    );
  }
}

