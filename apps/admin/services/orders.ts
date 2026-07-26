/**
 * Order service.
 *
 * Order value and quantity are computed by pure functions in @bread/shared, not
 * here — so the mobile app arrives at exactly the same numbers.
 */

import {
  orderQuantity,
  orderTotalPesewas,
  type Order,
  type OrderInput,
  type OrderLineDetail,
} from "@bread/shared";

import { getStore, newId, simulateLatency } from "./store";

export interface OrderWithContext {
  order: Order;
  customerName: string;
  /** Every kind of bread on the order, not just the first. */
  lines: OrderLineDetail[];
  quantity: number;
  totalPesewas: number;
}

export async function listOrders(): Promise<OrderWithContext[]> {
  const store = getStore();

  const orders = [...store.orders]
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
    .map(withContext);

  return simulateLatency(orders);
}

export async function listOrdersForDate(date: string): Promise<OrderWithContext[]> {
  const store = getStore();

  const orders = store.orders
    .filter((order) => order.deliveryDate === date)
    .map(withContext);

  return simulateLatency(orders);
}

export async function listOrdersForCustomer(
  customerId: string,
): Promise<OrderWithContext[]> {
  const store = getStore();

  const orders = store.orders
    .filter((order) => order.customerId === customerId)
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
    .map(withContext);

  return simulateLatency(orders);
}

export async function createOrder(input: OrderInput): Promise<Order> {
  const store = getStore();

  const id = newId("ord");

  const lines = input.lines.map((line, index) => {
    const product = store.products.find((entry) => entry.id === line.productId);
    if (!product) {
      throw new Error("That bread does not exist");
    }

    return {
      id: `${id}-l${index + 1}`,
      productId: product.id,
      quantity: line.quantity,
      // Price snapshotted at order time (decision 0004) — a later price
      // change must never rewrite what this order was worth.
      unitPricePesewas: product.pricePesewas,
    };
  });

  const order: Order = {
    id,
    customerId: input.customerId,
    deliveryDate: input.deliveryDate,
    status: "scheduled",
    source: "admin",
    createdAt: new Date().toISOString(),
    lines,
  };

  store.orders.push(order);
  store.deliveries.push({
    id: newId("dlv"),
    orderId: order.id,
    status: "pending",
    lines: lines.map((line) => ({
      orderLineId: line.id,
      deliveredQuantity: 0,
    })),
    deliveredAt: null,
  });

  return simulateLatency(order);
}

/** Resolve an order's lines to product names for display. */
export function orderLineDetails(order: Order): OrderLineDetail[] {
  const store = getStore();

  return order.lines.map((line) => {
    const product = store.products.find((entry) => entry.id === line.productId);
    return {
      lineId: line.id,
      productId: line.productId,
      productName: product?.name ?? "Unknown bread",
      quantity: line.quantity,
      unitPricePesewas: line.unitPricePesewas,
    };
  });
}

function withContext(order: Order): OrderWithContext {
  const store = getStore();
  const customer = store.customers.find((entry) => entry.id === order.customerId);

  return {
    order,
    customerName: customer?.name ?? "Unknown customer",
    lines: orderLineDetails(order),
    quantity: orderQuantity(order),
    totalPesewas: orderTotalPesewas(order),
  };
}
