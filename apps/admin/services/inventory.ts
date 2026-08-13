/**
 * Supply purchases — what the bakery bought, when, and for how much.
 *
 * This is the itemised source for cost reporting. It is deliberately NOT stock
 * on hand: knowing what is left would mean recording how much of each supply
 * goes into a bake, which nobody does today.
 */

import {
  cedisToPesewas,
  purchaseTotalPesewas,
  purchasesTotalPesewas,
  type Purchase,
  type PurchaseInput,
  type SupplyItem,
} from "@bread/shared";

import { supabase } from "@/lib/supabase";
import { loadPurchases, loadSupplyItems } from "./loaders";

export interface PurchaseWithItem {
  purchase: Purchase;
  item: SupplyItem;
  totalPesewas: number;
}

export async function listSupplyItems(): Promise<SupplyItem[]> {
  const items = await loadSupplyItems();
  return items.filter((item) => item.active);
}

export async function listPurchases(): Promise<PurchaseWithItem[]> {
  const [purchases, items] = await Promise.all([loadPurchases(), loadSupplyItems()]);

  return purchases
    .map((purchase) => withItem(purchase, items))
    .filter((entry): entry is PurchaseWithItem => entry !== null);
}

export async function listPurchasesForDate(
  date: string,
): Promise<PurchaseWithItem[]> {
  const [purchases, items] = await Promise.all([loadPurchases(), loadSupplyItems()]);

  return purchases
    .filter((entry) => entry.date === date)
    .map((purchase) => withItem(purchase, items))
    .filter((entry): entry is PurchaseWithItem => entry !== null);
}

export async function totalPurchasesForDate(date: string): Promise<number> {
  const purchases = await loadPurchases();
  return purchasesTotalPesewas(purchases.filter((entry) => entry.date === date));
}

export async function createPurchase(input: PurchaseInput): Promise<void> {
  const items = await loadSupplyItems();

  const item = items.find((entry) => entry.id === input.itemId);
  if (!item) {
    throw new Error("That item does not exist");
  }

  const { error } = await supabase.from("purchases").insert({
    item_id: item.id,
    date: input.date,
    quantity: input.quantity,
    unit: input.unit,
    unit_price_pesewas: cedisToPesewas(input.unitPriceCedis),
    supplier: input.supplier ?? null,
    note: input.note ?? null,
    recorded_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Could not save the purchase: ${error.message}`);
}

/**
 * Returns null when the supply behind a purchase is missing, which drops the
 * purchase from the list. Supplies are deactivated rather than deleted, and the
 * loader does not filter on active, so in practice this cannot happen.
 */
function withItem(
  purchase: Purchase,
  items: readonly SupplyItem[],
): PurchaseWithItem | null {
  const item = items.find((entry) => entry.id === purchase.itemId);
  if (!item) return null;

  return {
    purchase,
    item,
    totalPesewas: purchaseTotalPesewas(purchase),
  };
}
