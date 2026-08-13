import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { DemoBanner } from "@/components/demo-banner";
import { SiteHeader } from "@/components/site-header";
import { getSessionCustomerId } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Order Bread Online — Demo",
  description: "Place a demo order for fresh bread and see the ordering flow end to end.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read here rather than in the header so the header stays a client component
  // for the cart, without every page having to pass this down itself.
  const signedIn = (await getSessionCustomerId()) !== null;

  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full font-sans">
        <div className="min-h-screen">
          <DemoBanner />
          <SiteHeader signedIn={signedIn} />
          <main className="mx-auto w-full max-w-3xl px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
