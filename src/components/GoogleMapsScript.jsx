'use client';

import Script from 'next/script';

export function GoogleMapsScript() {
  // The environment variable should be prefixed with NEXT_PUBLIC_ to be available on client side
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Maps API key not found. Address autocomplete will not be available.');
    return null;
  }

  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`}
      strategy="lazyOnload"
      onLoad={() => {
        console.log('Google Maps API loaded successfully');
      }}
      onError={(e) => {
        console.error('Failed to load Google Maps API:', e);
      }}
    />
  );
}