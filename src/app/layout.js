import { Roboto } from "next/font/google";
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
import { AuthKitProvider } from "@/components/AuthKitProvider";
// import { MiniAppProvider } from '@neynar/react';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: 'swap',
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
        className={`${roboto.variable} antialiased`}
      >
        <GoogleMapsScript />
        <FrameInit />
        <AuthKitProvider>
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
        </AuthKitProvider>
      </body>
    </html>
  );
}
