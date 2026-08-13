import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { DemoBanner } from "@/components/demo-banner";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Order Bread Online — Demo",
  description: "Place a demo order for fresh bread and see the ordering flow end to end.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full font-sans">
        <div className="min-h-screen">
          <DemoBanner />
          <SiteHeader />
          <main className="mx-auto w-full max-w-3xl px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
