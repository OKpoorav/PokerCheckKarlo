import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Poker Tally",
  description: "Daily poker sessions, buy-ins and running P&L",
  appleWebApp: { capable: true, title: "Tally", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050f0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${playfair.variable} antialiased`}>
      <body className="min-h-dvh">
        <div aria-hidden className="table-bg" />
        <main className="mx-auto max-w-lg px-4 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-[calc(env(safe-area-inset-top)+12px)]">
          {children}
        </main>
      </body>
    </html>
  );
}
