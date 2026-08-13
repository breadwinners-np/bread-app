import type { Product } from "@bread/shared";

import { supabasePublic } from "./supabase-public";

interface ProductRow {
  id: string;
  name: string;
  unit: string;
  price_pesewas: number;
  active: boolean;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    pricePesewas: row.price_pesewas,
    active: row.active,
  };
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabasePublic
    .from("products")
    .select("id, name, unit, price_pesewas, active")
    .eq("active", true)
    .order("name");

  if (error) {
    throw new Error(`Could not load products: ${error.message}`);
  }

  return (data ?? []).map(toProduct);
}
