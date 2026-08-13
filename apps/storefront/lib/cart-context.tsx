"use client";

import { useMemo, useSyncExternalStore } from "react";

import * as cartStore from "./cart-store";

export type { CartLine } from "./cart-store";

export function useCart() {
  const lines = useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot,
  );

  const totalPesewas = useMemo(
    () => lines.reduce((sum, line) => sum + line.unitPricePesewas * line.quantity, 0),
    [lines],
  );

  return {
    lines,
    addToCart: cartStore.addToCart,
    setQuantity: cartStore.setQuantity,
    removeFromCart: cartStore.removeFromCart,
    clearCart: cartStore.clearCart,
    totalPesewas,
  };
}
