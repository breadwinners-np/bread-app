/**
 * Order service.
 *
 * Order value and quantity are computed by pure functions in @bread/shared, not
 * here — so the mobile app arrives at exactly the same numbers.
 */

import {
  monthOf,
  orderQuantity,
  orderTotalPesewas,
  type Customer,
  type Order,
  type OrderInput,
} from "@bread/shared";

import { supabase } from "@/lib/supabase";
import { loadCustomers, loadOrders, loadProducts } from "./loaders";

/**
 * An order with the little the screen needs around it.
 *
 * The breads are read straight off `order.lines`, which carry their own
 * snapshotted names — so listing orders no longer loads the product table at
 * all, and a bread that was renamed still reads as it did on the day.
 */
export interface OrderWithContext {
  order: Order;
  customerName: string;
  /** Total loaves across every bread on the order. */
  quantity: number;
  totalPesewas: number;
}

/** One day's worth of orders, as a calendar cell needs it. */
export interface OrderDaySummary {
  date: string;
  orderCount: number;
  quantity: number;
  valuePesewas: number;
}

/**
 * Every day in a month that has orders on it, keyed by day.
 *
 * Cancelled orders are left out: the calendar answers "what is going out that
 * day", and a cancelled order is not going out.
 */
export async function listOrderDaysForMonth(
  month: string,
): Promise<Record<string, OrderDaySummary>> {
  const orders = await loadOrders();
  const days: Record<string, OrderDaySummary> = {};

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    if (monthOf(order.deliveryDate) !== month) continue;

    const day = (days[order.deliveryDate] ??= {
      date: order.deliveryDate,
      orderCount: 0,
      quantity: 0,
      valuePesewas: 0,
    });

    day.orderCount += 1;
    day.quantity += orderQuantity(order);
    day.valuePesewas += orderTotalPesewas(order);
  }

  return days;
}

export async function listOrders(): Promise<OrderWithContext[]> {
  const [orders, customers] = await Promise.all([loadOrders(), loadCustomers()]);

  return orders.map((order) => withContext(order, customers));
}

export async function listOrdersForDate(date: string): Promise<OrderWithContext[]> {
  const [orders, customers] = await Promise.all([loadOrders(), loadCustomers()]);

  return orders
    .filter((order) => order.deliveryDate === date)
    .map((order) => withContext(order, customers));
}

export async function listOrdersForCustomer(
  customerId: string,
): Promise<OrderWithContext[]> {
  const [orders, customers] = await Promise.all([loadOrders(), loadCustomers()]);

  return orders
    .filter((order) => order.customerId === customerId)
    .map((order) => withContext(order, customers));
}

export async function createOrder(input: OrderInput): Promise<string> {
  const products = await loadProducts();

  const lines = input.lines.map((line) => {
    const product = products.find((entry) => entry.id === line.productId);
    if (!product) {
      throw new Error("That product does not exist");
    }

    return {
      product_id: product.id,
      product_name: product.name,
      // Price snapshotted at order time (decision 0004) — a later price
      // change must never rewrite what this order was worth.
      unit_price_pesewas: product.pricePesewas,
      quantity: line.quantity,
    };
  });

  // One call, so the order, all its breads and its delivery all exist or none
  // of them do. An order without a delivery silently drops off the day's round
  // while still counting toward what the customer owes.
  const { data, error } = await supabase.rpc("place_order", {
    p_customer_id: input.customerId,
    p_delivery_date: input.deliveryDate,
    p_source: "admin",
    p_lines: lines,
    p_delivery_address: input.deliveryAddress || null,
  });

  if (error) throw new Error(`Could not save the order: ${error.message}`);

  return data as string;
}

/**
 * Cancel an order, keeping the record.
 *
 * Nothing in this system is deleted — a cancelled order leaves the day's round
 * and stops being owed, but stays in history so past totals and the customer's
 * account still add up. Cancelling is also the only order state a delivery
 * cannot imply, which is why it is the only one stored.
 */
export async function cancelOrder(orderId: string): Promise<void> {
  const orders = await loadOrders();

  const order = orders.find((entry) => entry.id === orderId);
  if (!order) throw new Error("That order does not exist");
  if (order.status === "cancelled") return;

  const { error } = await supabase
    .from("orders")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) throw new Error(`Could not cancel the order: ${error.message}`);
}

function withContext(
  order: Order,
  customers: readonly Customer[],
): OrderWithContext {
  const customer = customers.find((entry) => entry.id === order.customerId);

  return {
    order,
    customerName: customer?.name ?? "Unknown customer",
    quantity: orderQuantity(order),
    totalPesewas: orderTotalPesewas(order),
  };
}
