import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FrameInit } from "@/components/FrameInit";
import { GoogleMapsScript } from "@/components/GoogleMapsScript";
import { FarcasterHeader } from "@/components/FarcasterHeader";
import { CartProvider } from "@/lib/CartContext";

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
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CartProvider>
          <div>
            <FarcasterHeader />
            {children}
            <FrameInit />
            <GoogleMapsScript />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
