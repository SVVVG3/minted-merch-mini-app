export const metadata = {
  title: 'Partner Dashboard | Minted Merch',
  description: 'Manage your assigned orders and view payouts on Minted Merch Partner Portal',
  openGraph: {
    title: 'Minted Merch Partner Portal',
    description: 'Process Orders • View Payouts',
    images: [
      {
        url: '/api/og/partner',
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
    images: ['/api/og/partner'],
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/api/og/partner`,
    'fc:frame:image:aspect_ratio': '1.91:1',
    'fc:frame:button:1': 'Open Partner Portal',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/partner`,
  },
};

export default function PartnerLayout({ children }) {
  return children;
}

