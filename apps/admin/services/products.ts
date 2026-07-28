import type { Product } from "@bread/shared";

import { getStore, simulateLatency } from "./store";

export async function listProducts(): Promise<Product[]> {
  const store = getStore();
  return simulateLatency(store.products.filter((product) => product.active));
}

export async function getProduct(id: string): Promise<Product | null> {
  const store = getStore();
  return simulateLatency(store.products.find((product) => product.id === id) ?? null);
}
