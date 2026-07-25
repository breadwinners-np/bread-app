import { sumPesewas, type Cost } from "@bread/shared";

import { getStore, simulateLatency } from "./store";

export async function listCostsForDate(date: string): Promise<Cost[]> {
  const store = getStore();
  return simulateLatency(store.costs.filter((cost) => cost.date === date));
}

export async function totalCostsForDate(date: string): Promise<number> {
  const costs = await listCostsForDate(date);
  return sumPesewas(costs.map((cost) => cost.amountPesewas));
}
