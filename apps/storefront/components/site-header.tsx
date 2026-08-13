"use client";

import Link from "next/link";

import { useCart } from "@/lib/cart-context";

export function SiteHeader() {
  const { lines } = useCart();
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold text-stone-900">
          Fresh Bread — Order Online
        </Link>
        <Link
          href="/checkout"
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white"
        >
          Cart ({itemCount})
        </Link>
      </div>
    </header>
  );
}
