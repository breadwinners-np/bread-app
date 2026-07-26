/**
 * Pure business logic for orders, deliveries, and balances.
 *
 * Everything here is a pure function over domain types — no I/O, no framework.
 * Both the admin app and the mobile app use these, so the two can never
 * disagree about what an order is worth.
 */

import { sumPesewas } from "./money";
import type {
  Delivery,
  DeliveryStatus,
  Order,
  OrderStatus,
  Payment,
} from "./types";

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
 * A customer's outstanding balance, in pesewas: what they have been billed
 * less what they have paid. Positive means the customer owes money.
 *
 * OPEN (PAY-3): this counts every recorded payment, including cheques that may
 * not have cleared. Once the cheque lifecycle is decided, this should filter on
 * payment status.
 *
 * OPEN (PAY-6): nothing here prevents a negative balance, because whether a
 * customer may go into credit — and by how much — is not yet decided.
 */
export function customerBalancePesewas(
  orders: readonly Order[],
  payments: readonly Payment[],
): number {
  const billed = ordersTotalPesewas(
    orders.filter((order) => order.status !== "cancelled"),
  );
  const paid = sumPesewas(payments.map((payment) => payment.amountPesewas));
  return billed - paid;
}
