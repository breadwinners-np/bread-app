/**
 * Pure logic for supply purchases.
 *
 * Purchases are the itemised half of costs: what was bought, how much of it,
 * and at what price. Transport and anything without a countable item stays a
 * plain cost entry.
 */

import { sumPesewas } from "./money";
import type { Purchase, UnitOfMeasure } from "./types";

export const UNIT_LABELS: Record<UnitOfMeasure, { one: string; many: string }> =
  {
    piece: { one: "piece", many: "pieces" },
    kg: { one: "kg", many: "kg" },
    g: { one: "g", many: "g" },
    litre: { one: "litre", many: "litres" },
    sack: { one: "sack", many: "sacks" },
    box: { one: "box", many: "boxes" },
    crate: { one: "crate", many: "crates" },
  };

export const UNIT_OPTIONS: readonly UnitOfMeasure[] = [
  "sack",
  "kg",
  "g",
  "litre",
  "piece",
  "box",
  "crate",
];

/** e.g. `formatQuantity(4, "sack")` -> "4 sacks", `formatQuantity(2.5, "kg")` -> "2.5 kg". */
export function formatQuantity(quantity: number, unit: UnitOfMeasure): string {
  const labels = UNIT_LABELS[unit];
  const rounded = Math.round(quantity * 100) / 100;
  const label = rounded === 1 ? labels.one : labels.many;
  return `${rounded} ${label}`;
}

/**
 * What a purchase cost in total, in pesewas.
 *
 * Quantity may be fractional, so the result is rounded once, at the end. Never
 * round the unit price first — doing so drifts across a month of buying.
 */
export function purchaseTotalPesewas(purchase: {
  quantity: number;
  unitPricePesewas: number;
}): number {
  return Math.round(purchase.quantity * purchase.unitPricePesewas);
}

export function purchasesTotalPesewas(purchases: readonly Purchase[]): number {
  return sumPesewas(purchases.map(purchaseTotalPesewas));
}
