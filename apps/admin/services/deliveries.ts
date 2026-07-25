/**
 * Delivery service — the daily distribution round.
 *
 * This is the flow that has to work offline on the mobile side (DST-3). Here on
 * the laptop it is a plain server call, but the shape is deliberately simple:
 * read a day's list, record one outcome at a time.
 */

import {
  orderStatusForDelivery,
  type DeliveryListItem,
  type RecordDeliveryInput,
} from "@bread/shared";

import { getStore, simulateLatency } from "./store";

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
