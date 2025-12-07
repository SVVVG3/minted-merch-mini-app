import FollowPageClient from './FollowPageClient';

export const metadata = {
  title: 'Follow Minted Merch | Earn 10,000 $mintedmerch',
  description: 'Follow @mintedmerch, join /mintedmerch channel, and enable notifications to earn 10,000 $mintedmerch tokens!',
  openGraph: {
    title: 'Follow Minted Merch | Earn 10,000 $mintedmerch',
    description: 'Follow @mintedmerch, join /mintedmerch channel, and enable notifications to earn 10,000 $mintedmerch tokens!',
    images: ['/api/og/follow'],
  },
  other: {
    'fc:frame': JSON.stringify({
      version: 'next',
      imageUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/api/og/follow`,
      button: {
        title: 'Complete Mission',
        action: {
          type: 'launch_frame',
          name: 'Minted Merch',
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/follow`,
          splashImageUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop'}/splash.png`,
          splashBackgroundColor: '#000000'
        }
      }
    })
  }
};

export default function FollowPage() {
  return <FollowPageClient />;
}

