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
  type CostCategory,
  type Purchase,
  type PurchaseInput,
  type SupplyItem,
} from "@bread/shared";

import { getStore, newId, simulateLatency } from "./store";

export interface PurchaseWithItem {
  purchase: Purchase;
  item: SupplyItem;
  totalPesewas: number;
}

export async function listSupplyItems(): Promise<SupplyItem[]> {
  const store = getStore();
  return simulateLatency(
    store.supplyItems
      .filter((item) => item.active)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function listPurchases(): Promise<PurchaseWithItem[]> {
  const store = getStore();

  const purchases = [...store.purchases]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(withItem)
    .filter((entry): entry is PurchaseWithItem => entry !== null);

  return simulateLatency(purchases);
}

export async function listPurchasesForDate(
  date: string,
): Promise<PurchaseWithItem[]> {
  const store = getStore();

  const purchases = store.purchases
    .filter((entry) => entry.date === date)
    .map(withItem)
    .filter((entry): entry is PurchaseWithItem => entry !== null);

  return simulateLatency(purchases);
}

export async function totalPurchasesForDate(date: string): Promise<number> {
  const store = getStore();
  return purchasesTotalPesewas(
    store.purchases.filter((entry) => entry.date === date),
  );
}

/** Spend per cost category over a date range, inclusive. */
export async function purchaseTotalsByCategory(
  from: string,
  to: string,
): Promise<Record<CostCategory, number>> {
  const store = getStore();

  const totals: Record<CostCategory, number> = {
    gas: 0,
    ingredients: 0,
    transport: 0,
  };

  for (const entry of store.purchases) {
    if (entry.date < from || entry.date > to) continue;
    const item = store.supplyItems.find((supply) => supply.id === entry.itemId);
    if (!item) continue;
    totals[item.category] += purchaseTotalPesewas(entry);
  }

  return simulateLatency(totals);
}

/**
 * Most recent price paid per unit for an item, so the owner can see when a
 * supplier's price moves. Returns null if the item has never been bought.
 */
export async function lastUnitPricePesewas(
  itemId: string,
): Promise<number | null> {
  const store = getStore();

  const latest = store.purchases
    .filter((entry) => entry.itemId === itemId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return simulateLatency(latest?.unitPricePesewas ?? null);
}

export async function createPurchase(input: PurchaseInput): Promise<Purchase> {
  const store = getStore();

  const item = store.supplyItems.find((entry) => entry.id === input.itemId);
  if (!item) {
    throw new Error("That item does not exist");
  }

  const purchase: Purchase = {
    id: newId("pur"),
    itemId: item.id,
    date: input.date,
    quantity: input.quantity,
    unit: input.unit,
    unitPricePesewas: cedisToPesewas(input.unitPriceCedis),
    supplier: input.supplier,
    note: input.note,
    recordedAt: new Date().toISOString(),
  };

  store.purchases.push(purchase);
  return simulateLatency(purchase);
}

function withItem(purchase: Purchase): PurchaseWithItem | null {
  const store = getStore();
  const item = store.supplyItems.find((entry) => entry.id === purchase.itemId);
  if (!item) return null;

  return {
    purchase,
    item,
    totalPesewas: purchaseTotalPesewas(purchase),
  };
}
