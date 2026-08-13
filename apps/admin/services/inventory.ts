/**
 * Supply purchases — what the bakery bought, when, and for how much.
 *
 * This is the itemised source for cost reporting. It is deliberately NOT stock
 * on hand: knowing what is left would mean recording how much of each supply
 * goes into a bake, which nobody does today.
 */

import {
  NEW_SUPPLY_ITEM,
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

/**
 * Add something the list did not have.
 *
 * The supply list was fixed — flour, yeast, butter, sugar, gas — and a bakery
 * buys things nobody thought of. A purchase she cannot record is a cost
 * missing from her reports, which is worse than a slightly longer list.
 *
 * An item she has bought before is reused rather than added twice, matched on
 * the name ignoring case and spacing, so "Baking soda" and "baking soda " stay
 * one line in her spending. Answers INV-2; see decision 0028.
 */
async function findOrCreateSupplyItem(
  name: string,
  category: NonNullable<PurchaseInput["newItemCategory"]>,
  unit: PurchaseInput["unit"],
): Promise<SupplyItem> {
  const items = await loadSupplyItems();
  const wanted = name.trim().toLowerCase();

  const existing = items.find(
    (entry) => entry.name.trim().toLowerCase() === wanted,
  );
  if (existing) return existing;

  const { data, error } = await supabase
    .from("supply_items")
    .insert({ name: name.trim(), default_unit: unit, category, active: true })
    .select("*")
    .single();

  if (error) throw new Error(`Could not add that item: ${error.message}`);

  return {
    id: data.id as string,
    name: data.name as string,
    defaultUnit: data.default_unit as SupplyItem["defaultUnit"],
    category: data.category as SupplyItem["category"],
    active: data.active as boolean,
  };
}

export async function createPurchase(input: PurchaseInput): Promise<void> {
  const item =
    input.itemId === NEW_SUPPLY_ITEM
      ? await findOrCreateSupplyItem(
          input.newItemName ?? "",
          input.newItemCategory ?? "ingredients",
          input.unit,
        )
      : (await loadSupplyItems()).find((entry) => entry.id === input.itemId);

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
