import { redirect } from 'next/navigation';

// Redirect old /merchmogulmissions URL to new /missions URL
export default function MerchMogulMissionsRedirect() {
  redirect('/missions');
}

// Also redirect metadata/frame embeds to new URL
export async function generateMetadata() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.mintedmerch.shop').replace(/\/$/, '');
  
  return {
    title: 'Redirecting to Minted Merch Missions...',
    description: 'This page has moved to /missions',
    alternates: {
      canonical: `${baseUrl}/missions`,
    },
  };
}
