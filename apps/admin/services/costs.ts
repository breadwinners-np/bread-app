import { sumPesewas, type Cost } from "@bread/shared";

import { loadCosts } from "./loaders";
import { totalPurchasesForDate } from "./inventory";

export async function listCostsForDate(date: string): Promise<Cost[]> {
  const costs = await loadCosts();
  return costs.filter((cost) => cost.date === date);
}

/**
 * Everything spent on a day: itemised purchases plus costs that have no
 * countable item, such as transport.
 *
 * OPEN (CST-3): this treats a purchase as a cost on the day it was bought. If
 * costs should instead be spread across the days the supply is used, this
 * number means something different and will need rework.
 */
export async function totalCostsForDate(date: string): Promise<number> {
  const [costs, purchaseTotal] = await Promise.all([
    listCostsForDate(date),
    totalPurchasesForDate(date),
  ]);

  return sumPesewas(costs.map((cost) => cost.amountPesewas)) + purchaseTotal;
}
