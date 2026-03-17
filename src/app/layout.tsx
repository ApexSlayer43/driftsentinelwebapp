import type { Metadata } from "next";
import { JetBrains_Mono, Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Drift Sentinel — Behavioral Intelligence",
  description: "Behavioral intelligence dashboard for futures traders. Maximize BSS, not PnL.",
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.svg',
  },
  openGraph: {
    title: "Drift Sentinel — Behavioral Intelligence",
    description: "Behavioral intelligence dashboard for futures traders. Maximize BSS, not PnL.",
    images: [{ url: '/og-image.svg', width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrainsMono.variable} ${cormorantGaramond.variable} ${dmSans.variable} antialiased`}>
        {children}
        {/* Grain texture — film stock overlay across entire app */}
        <div className="grain-overlay" aria-hidden="true" />
      </body>
    </html>
  );
}
