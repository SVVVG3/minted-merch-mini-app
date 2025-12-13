const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop';
const imageUrl = `${baseUrl}/api/og/partner`;

// Create frame embed for Farcaster (same format as other pages)
const frame = {
  version: "next",
  imageUrl: imageUrl,
  button: {
    title: "Open Partner Portal",
    action: {
      type: "launch_frame",
      url: `${baseUrl}/partner`,
      name: "Minted Merch Partner",
      splashImageUrl: `${baseUrl}/splash.png`,
      splashBackgroundColor: "#000000"
    }
  }
};

export const metadata = {
  title: 'Partner Dashboard | Minted Merch',
  description: 'Process orders and view payouts on Minted Merch Partner Portal',
  metadataBase: new URL(baseUrl),
  other: {
    'fc:frame': JSON.stringify(frame),
  },
  openGraph: {
    title: 'Minted Merch Partner Portal',
    description: 'Process Orders • View Payouts',
    siteName: 'Minted Merch',
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: 'Minted Merch Partner Portal',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Minted Merch Partner Portal',
    description: 'Process Orders • View Payouts',
    images: [imageUrl],
  },
};

export default function PartnerLayout({ children }) {
  return children;
}
