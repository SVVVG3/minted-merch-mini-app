import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FrameInit } from "@/components/FrameInit";
import { GoogleMapsScript } from "@/components/GoogleMapsScript";

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div>
          {children}
          <FrameInit />
          <GoogleMapsScript />
        </div>
      </body>
    </html>
  );
}
