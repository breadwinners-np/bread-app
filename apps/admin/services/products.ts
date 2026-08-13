import type { Product } from "@bread/shared";

import { loadProducts } from "./loaders";

export async function listProducts(): Promise<Product[]> {
  const products = await loadProducts();
  return products.filter((product) => product.active);
}
