import { ImageResponse } from 'next/og';

// Helper function to fetch and convert image to data URL
async function fetchImageAsDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'Collection';
    const handle = searchParams.get('handle') || 'collection';
    const imageUrl = searchParams.get('image');
    const description = searchParams.get('description') || '';
    
    // Fetch and convert collection image if provided
    let collectionImageSrc = null;
    if (imageUrl) {
      console.log('Fetching collection image:', imageUrl);
      collectionImageSrc = await fetchImageAsDataUrl(imageUrl);
      console.log('Collection image fetch result:', collectionImageSrc ? 'SUCCESS' : 'FAILED');
    }
    
    // Fetch logo image
    const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/logo.png`;
    let logoImageSrc = null;
    try {
      logoImageSrc = await fetchImageAsDataUrl(logoUrl);
    } catch (error) {
      console.error('Error fetching logo:', error);
    }
    
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
            backgroundImage: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
            position: 'relative',
          }}
        >
          {/* Main Content Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              padding: '60px',
              gap: '60px',
            }}
          >
            {/* Collection Image */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '400px',
                height: '400px',
                borderRadius: '20px',
                backgroundColor: 'rgba(62, 180, 137, 0.1)',
                border: '3px solid rgba(62, 180, 137, 0.3)',
                overflow: 'hidden',
              }}
            >
              {collectionImageSrc ? (
                <img
                  src={collectionImageSrc}
                  alt={title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : logoImageSrc ? (
                <img
                  src={logoImageSrc}
                  alt="Minted Merch"
                  style={{
                    width: '300px',
                    height: '300px',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3eb489',
                  }}
                >
                  <div style={{ fontSize: 120, marginBottom: 20 }}>📦</div>
                  <div style={{ fontSize: 32, textAlign: 'center' }}>Collection</div>
                </div>
              )}
            </div>

            {/* Text Content */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                maxWidth: '500px',
                gap: '20px',
              }}
            >
              {/* Collection Title */}
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 'bold',
                  color: '#3eb489',
                  lineHeight: 1.1,
                  textAlign: 'left',
                }}
              >
                {title}
              </div>

              {/* Collection Description */}
              {description && (
                <div
                  style={{
                    fontSize: 28,
                    color: '#cccccc',
                    lineHeight: 1.3,
                    textAlign: 'left',
                    maxHeight: '120px',
                    overflow: 'hidden',
                  }}
                >
                  {description.length > 120 ? description.substring(0, 120) + '...' : description}
                </div>
              )}

              {/* Collection Label */}
              <div
                style={{
                  fontSize: 32,
                  color: '#888888',
                  textAlign: 'left',
                }}
              >
                Collection
              </div>

              {/* Shop Info */}
              <div
                style={{
                  fontSize: 24,
                  color: '#3eb489',
                  textAlign: 'left',
                  marginTop: '20px',
                }}
              >
                Shop with USDC on Base 🟦
              </div>
            </div>
          </div>

          {/* Logo in Bottom Right Corner */}
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
        height: 800,
      },
    );
    
  } catch (error) {
    console.error('Collection OG Error:', error);
    
    // Return fallback image
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
          <div style={{ fontSize: 100, color: '#3eb489' }}>📦</div>
          <div style={{ fontSize: 48, marginTop: 20, color: '#3eb489' }}>Minted Merch</div>
          <div style={{ fontSize: 32, color: '#3eb489', marginTop: 20 }}>Shop collections with USDC!</div>
          <div style={{ fontSize: 24, color: '#888', marginTop: 20 }}>Error loading collection details</div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      },
    );
  }
}
