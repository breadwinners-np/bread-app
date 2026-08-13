/**
 * Pure business logic for orders, deliveries, and balances.
 *
 * Everything here is a pure function over domain types — no I/O, no framework.
 * Both the admin app and the mobile app use these, so the two can never
 * disagree about what an order is worth.
 */

import { sumPesewas } from "./money";
import type { Delivery, DeliveryStatus, Order, OrderStatus } from "./types";

/** What an order line is worth, in pesewas. */
export function lineTotalPesewas(line: {
  quantity: number;
  unitPricePesewas: number;
}): number {
  return line.quantity * line.unitPricePesewas;
}

/** What a whole order is worth, in pesewas. */
export function orderTotalPesewas(order: Order): number {
  return sumPesewas(order.lines.map(lineTotalPesewas));
}

/** Total loaves (or other units) on an order, across all lines. */
export function orderQuantity(order: Order): number {
  return order.lines.reduce((total, line) => total + line.quantity, 0);
}

/** What several orders are worth together. */
export function ordersTotalPesewas(orders: readonly Order[]): number {
  return sumPesewas(orders.map(orderTotalPesewas));
}

/**
 * The order status implied by a delivery outcome.
 *
 * Note this maps the delivery to the order's status only. Whether a short or
 * refused delivery reduces what the customer owes is OPEN (DST-7) — no money
 * logic is applied here on purpose.
 */
export function orderStatusForDelivery(status: DeliveryStatus): OrderStatus {
  switch (status) {
    case "delivered":
      return "delivered";
    case "partial":
      return "partially_delivered";
    case "not_delivered":
    case "pending":
      return "scheduled";
  }
}

/**
 * How much actually arrived, decided rather than taken on trust.
 *
 * Server actions are reachable by direct POST, so every field in a submission
 * is under the caller's control — including the ordered quantity the form sends
 * alongside it. The caller passes what the order really says, and this decides
 * the rest: a full delivery is worth the whole order and a failed one nothing,
 * so neither needs a number from the form at all. Only a part delivery does,
 * and it cannot exceed what was ordered.
 */
export function resolveDeliveredQuantity(
  status: Exclude<DeliveryStatus, "pending">,
  requested: number,
  orderedQuantity: number,
): number {
  switch (status) {
    case "delivered":
      return orderedQuantity;
    case "not_delivered":
      return 0;
    case "partial":
      if (requested < 1) {
        throw new Error(
          "A part delivery has to be at least one. Use “could not deliver” if nothing arrived.",
        );
      }
      if (requested > orderedQuantity) {
        throw new Error(
          `Only ${orderedQuantity} were ordered, so ${requested} cannot have been delivered`,
        );
      }
      return requested;
  }
}

export function isDeliveryComplete(delivery: Delivery): boolean {
  return delivery.status === "delivered" || delivery.status === "partial";
}

/** How many of a day's deliveries are done. */
export function deliveryProgress(deliveries: readonly Delivery[]): {
  done: number;
  total: number;
} {
  return {
    done: deliveries.filter(isDeliveryComplete).length,
    total: deliveries.length,
  };
}

/**
 * Why a delivery still needs the owner's attention.
 *
 * - `failed` — someone tried and could not deliver it.
 * - `overdue` — the day passed and nothing was ever recorded against it.
 *
 * Partial deliveries are deliberately NOT counted here. A short drop leaves
 * bread undelivered, but whether the remainder is owed, redelivered, or written
 * off is an open question (DST-7). Counting them would mean choosing an answer.
 */
export type OutstandingReason = "failed" | "overdue";

export function outstandingReason(
  order: Order,
  delivery: Delivery,
  today: string,
): OutstandingReason | null {
  if (order.status === "cancelled") return null;
  if (delivery.status === "not_delivered") return "failed";
  if (delivery.status === "pending" && order.deliveryDate < today) {
    return "overdue";
  }
  return null;
}

/**
 * Balances live in `payments.ts`, because what a customer owes now depends on
 * how the delivery went, not only on what was ordered (decision 0012).
 */
