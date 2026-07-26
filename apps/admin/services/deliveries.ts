/**
 * Delivery service — the daily distribution round.
 *
 * This is the flow that has to work offline on the mobile side (DST-3). Here on
 * the laptop it is a plain server call, but the shape is deliberately simple:
 * read a day's list, record one outcome at a time.
 */

import {
  daysBetween,
  orderStatusForDelivery,
  outstandingReason,
  todayIso,
  type DeliveryListItem,
  type OutstandingReason,
  type RecordDeliveryInput,
  type RescheduleDeliveryInput,
} from "@bread/shared";

import { getStore, simulateLatency } from "./store";

/** A delivery that still needs the owner to do something about it. */
export interface OutstandingDelivery extends DeliveryListItem {
  reason: OutstandingReason;
  /** Whole days between the day it was due and today. */
  daysLate: number;
}

export async function listDeliveriesForDate(
  date: string,
): Promise<DeliveryListItem[]> {
  const store = getStore();

  const items = store.orders
    .filter((order) => order.deliveryDate === date && order.status !== "cancelled")
    .map((order) => {
      const delivery = store.deliveries.find((entry) => entry.orderId === order.id);
      const customer = store.customers.find((entry) => entry.id === order.customerId);
      const firstLine = order.lines[0];
      const product = store.products.find((entry) => entry.id === firstLine?.productId);

      if (!delivery || !customer) return null;

      return {
        order,
        customer,
        delivery,
        productName: product?.name ?? "Unknown product",
        orderedQuantity: order.lines.reduce(
          (total, line) => total + line.quantity,
          0,
        ),
      } satisfies DeliveryListItem;
    })
    .filter((item): item is DeliveryListItem => item !== null)
    .sort((a, b) => a.customer.name.localeCompare(b.customer.name));

  return simulateLatency(items);
}

/**
 * Every delivery that failed or was never recorded, oldest first.
 *
 * Deliberately not date-scoped: the point of this list is that these fell
 * through the cracks of the daily round, so scoping it to a day would hide
 * exactly the ones that matter.
 */
export async function listOutstandingDeliveries(): Promise<OutstandingDelivery[]> {
  const store = getStore();
  const today = todayIso();

  const items = store.orders
    .map((order) => {
      const delivery = store.deliveries.find((entry) => entry.orderId === order.id);
      const customer = store.customers.find((entry) => entry.id === order.customerId);
      if (!delivery || !customer) return null;

      const reason = outstandingReason(order, delivery, today);
      if (!reason) return null;

      const firstLine = order.lines[0];
      const product = store.products.find((entry) => entry.id === firstLine?.productId);

      return {
        order,
        customer,
        delivery,
        productName: product?.name ?? "Unknown product",
        orderedQuantity: order.lines.reduce(
          (total, line) => total + line.quantity,
          0,
        ),
        reason,
        daysLate: daysBetween(order.deliveryDate, today),
      } satisfies OutstandingDelivery;
    })
    .filter((item): item is OutstandingDelivery => item !== null)
    .sort((a, b) => a.order.deliveryDate.localeCompare(b.order.deliveryDate));

  return simulateLatency(items);
}

/**
 * Move a delivery to a later day.
 *
 * The order itself moves, rather than a second order being created, so one
 * order stays equal to one obligation and a rescheduled drop is never billed
 * twice. The original date is kept on the order so the move is visible.
 *
 * OPEN: whether each attempt should survive as its own record, and whether a
 * repeatedly-failed delivery is eventually written off, are undecided. See the
 * open questions in DECISIONS.md.
 */
export async function rescheduleDelivery(
  input: RescheduleDeliveryInput,
): Promise<void> {
  const store = getStore();

  const order = store.orders.find((entry) => entry.id === input.orderId);
  const delivery = store.deliveries.find((entry) => entry.orderId === input.orderId);

  if (!order || !delivery) {
    throw new Error("That delivery does not exist");
  }

  if (input.newDate <= order.deliveryDate) {
    throw new Error("Pick a day after the one it was originally due");
  }

  order.rescheduledFrom = order.rescheduledFrom ?? order.deliveryDate;
  order.deliveryDate = input.newDate;
  order.status = "scheduled";

  delivery.status = "pending";
  delivery.deliveredQuantity = 0;
  delivery.deliveredAt = null;

  await simulateLatency(null);
}

export async function recordDelivery(input: RecordDeliveryInput): Promise<void> {
  const store = getStore();

  const delivery = store.deliveries.find((entry) => entry.orderId === input.orderId);
  const order = store.orders.find((entry) => entry.id === input.orderId);

  if (!delivery || !order) {
    throw new Error("That delivery does not exist");
  }

  delivery.status = input.status;
  delivery.deliveredQuantity = input.deliveredQuantity;
  delivery.deliveredAt = new Date().toISOString();
  delivery.note = input.note;

  order.status = orderStatusForDelivery(input.status);

  await simulateLatency(null);
}
