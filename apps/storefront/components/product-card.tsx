"use client";

import { formatGhs, type Product } from "@bread/shared";

import { useCart } from "@/lib/cart-context";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();

  return (
    <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-5">
      <div>
        <p className="text-lg font-medium text-stone-900">{product.name}</p>
        <p className="text-stone-600">
          {formatGhs(product.pricePesewas)} / {product.unit}
        </p>
      </div>
      <button
        type="button"
        onClick={() => addToCart(product)}
        className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        Add to cart
      </button>
    </div>
  );
}
