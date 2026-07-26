/**
 * Order service.
 *
 * Order value and quantity are computed by pure functions in @bread/shared, not
 * here — so the mobile app arrives at exactly the same numbers.
 */

import { orderTotalPesewas, type Order, type OrderInput } from "@bread/shared";

import { getStore, newId, simulateLatency } from "./store";

export interface OrderWithContext {
  order: Order;
  customerName: string;
  productName: string;
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

  const product = store.products.find((entry) => entry.id === input.productId);
  if (!product) {
    throw new Error("That product does not exist");
  }

  const id = newId("ord");
  const order: Order = {
    id,
    customerId: input.customerId,
    deliveryDate: input.deliveryDate,
    status: "scheduled",
    source: "admin",
    createdAt: new Date().toISOString(),
    lines: [
      {
        id: `${id}-l1`,
        productId: product.id,
        quantity: input.quantity,
        // Price snapshotted at order time (decision 0004) — a later price
        // change must never rewrite what this order was worth.
        unitPricePesewas: product.pricePesewas,
      },
    ],
  };

  store.orders.push(order);
  store.deliveries.push({
    id: newId("dlv"),
    orderId: order.id,
    status: "pending",
    deliveredQuantity: 0,
    deliveredAt: null,
  });

  return simulateLatency(order);
}

function withContext(order: Order): OrderWithContext {
  const store = getStore();

  const customer = store.customers.find((entry) => entry.id === order.customerId);
  const firstLine = order.lines[0];
  const product = store.products.find((entry) => entry.id === firstLine?.productId);

  return {
    order,
    customerName: customer?.name ?? "Unknown customer",
    productName: product?.name ?? "Unknown product",
    quantity: order.lines.reduce((total, line) => total + line.quantity, 0),
    totalPesewas: orderTotalPesewas(order),
  };
}
