import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// import "@neynar/react/dist/style.css";
import dynamic from 'next/dynamic';
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

// Dynamic import to prevent SSR issues with wagmi hooks
const WalletConnectProvider = dynamic(
  () => import('@/components/WalletConnectProvider').then(mod => mod.WalletConnectProvider),
  { ssr: false }
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Minted Merch - Shop with Crypto",
  description: "Shop exclusive merchandise with USDC. Spin the wheel, earn points, and join the Minted Merch community.",
  icons: {
    icon: '/MintedMerchHeaderLogo.png',
    shortcut: '/MintedMerchHeaderLogo.png',
    apple: '/MintedMerchHeaderLogo.png',
  },
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
        <AuthKitProvider>
          <WagmiProvider>
            <BaseAccountProvider>
              <WalletConnectProvider>
                <CartProvider>
                  <div>
                    <PriceTicker />
                    <FarcasterHeader />
                    <ChatEligibilityBanner />
                    {children}
                    <ChatEligibilityPopup />
                  </div>
                </CartProvider>
              </WalletConnectProvider>
            </BaseAccountProvider>
          </WagmiProvider>
        </AuthKitProvider>
      </body>
    </html>
  );
}
