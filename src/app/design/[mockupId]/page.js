import { Suspense } from 'react';
import { DesignViewClient } from './DesignViewClient';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');

const PRODUCT_LABELS = { tshirt: 'T-Shirt', hoodie: 'Hoodie', hat: 'Hat' };

export async function generateMetadata({ params, searchParams }) {
  const { mockupId } = await params;
  const resolvedSearchParams = searchParams?.then ? await searchParams : searchParams;
  const isDropShare = resolvedSearchParams?.dropShare === '1';

  try {
    const res = await fetch(`${BASE_URL}/api/design-studio/mockup/${mockupId}`, { cache: 'no-store' });
    if (res.ok) {
      const { mockup, creator } = await res.json();
      const productLabel = mockup?.product_type
        ? (PRODUCT_LABELS[mockup.product_type] || mockup.product_type.charAt(0).toUpperCase() + mockup.product_type.slice(1))
        : 'Design';
      const creatorName = creator?.username ? `@${creator.username}` : 'a Minted Merch creator';
      const title = `Custom ${productLabel} by ${creatorName} — Minted Merch`;
      const description = `Check out this custom design and buy it on Minted Merch!`;
      const launchUrl = isDropShare
        ? `${BASE_URL}/?collection=limited-drops`
        : `${BASE_URL}/design/${mockupId}`;

      // Build branded OG image URL
      const mogulTier = creator?.isGoldMogul ? 'gold' : creator?.isMerchMogul ? 'green' : '';
      const ogParams = new URLSearchParams({
        ...(mockup?.mockup_url && { mockupUrl: mockup.mockup_url }),
        ...(mockup?.product_type && { productType: mockup.product_type }),
        ...(mockup?.color_name && { colorName: mockup.color_name }),
        ...(creator?.username && { creatorHandle: `@${creator.username}` }),
        ...(mogulTier && { mogulTier }),
      });
      const imageUrl = `${BASE_URL}/api/og/design?${ogParams.toString()}`;

      return {
        title,
        description,
        openGraph: { title, description, images: [{ url: imageUrl, width: 1200, height: 800 }] },
        other: {
          'fc:frame': JSON.stringify({
            version: 'next',
            imageUrl,
            button: {
              title: 'Create & Order Your Design 🎨',
              action: {
                type: 'launch_frame',
                url: launchUrl,
                name: 'Minted Merch',
                splashImageUrl: `${BASE_URL}/splash.png`,
                splashBackgroundColor: '#000000',
              },
            },
          }),
        },
      };
    }
  } catch {
    // fall through to defaults
  }

  return {
    title: 'Custom Design — Minted Merch',
    description: 'Buy this custom design on Minted Merch.',
    openGraph: { images: [`${BASE_URL}/og-image.png`] },
  };
}

export default async function DesignPage({ params }) {
  const { mockupId } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]" />
        </div>
      }
    >
      <DesignViewClient mockupId={mockupId} />
    </Suspense>
  );
}
