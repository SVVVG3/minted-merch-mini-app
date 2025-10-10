import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// import "@neynar/react/dist/style.css";
import { FrameInit } from "@/components/FrameInit";
import { GoogleMapsScript } from "@/components/GoogleMapsScript";
import { FarcasterHeader } from "@/components/FarcasterHeader";
import { PriceTicker } from "@/components/PriceTicker";
import { ChatEligibilityBanner } from "@/components/ChatEligibilityBanner";
import { ChatEligibilityPopup } from "@/components/ChatEligibilityPopup";
import { CartProvider } from "@/lib/CartContext";
import { WagmiProvider } from "@/components/WagmiProvider";
import { BaseAccountProvider } from "@/components/BaseAccountProvider";
// import { MiniAppProvider } from '@neynar/react';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Shopify Mini App Frame",
  description: "Farcaster frame for shopping with USDC",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://auth.farcaster.xyz" />
        {/* Conditionally load Base Account SDK only in Base app */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Only load Base Account SDK if we're in Base app
              if (typeof window !== 'undefined') {
                const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
                const isBaseApp = userAgent.includes('base') || 
                                  window.location?.hostname?.includes('base.app') ||
                                  window.location?.search?.includes('base_app=true');
                
                if (isBaseApp && !userAgent.includes('warpcast') && !userAgent.includes('farcaster')) {
                  const script = document.createElement('script');
                  script.src = 'https://unpkg.com/@base-org/account/dist/base-account.min.js';
                  script.async = true;
                  document.head.appendChild(script);
                  console.log('🚀 Loading Base Account SDK for Base app environment');
                } else {
                  console.log('🔗 Not in Base app environment, skipping Base Account SDK');
                }
              }
            `
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleMapsScript />
        <FrameInit />
        <WagmiProvider>
          <BaseAccountProvider>
            <CartProvider>
              <div>
                <PriceTicker />
                <FarcasterHeader />
                <ChatEligibilityBanner />
                {children}
                <ChatEligibilityPopup />
              </div>
            </CartProvider>
          </BaseAccountProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
