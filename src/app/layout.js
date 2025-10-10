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
        {/* Base Account SDK is now loaded via Wagmi connector */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleMapsScript />
        <FrameInit />
        <WagmiProvider>
          {/* Temporarily disabled BaseAccountProvider to prevent crashes */}
          {/* <BaseAccountProvider> */}
            <CartProvider>
              <div>
                <PriceTicker />
                <FarcasterHeader />
                <ChatEligibilityBanner />
                {children}
                <ChatEligibilityPopup />
              </div>
            </CartProvider>
          {/* </BaseAccountProvider> */}
        </WagmiProvider>
      </body>
    </html>
  );
}
