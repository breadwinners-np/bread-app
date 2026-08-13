import "server-only";

import { cache } from "react";

import {
  toCost,
  toCustomer,
  toDelivery,
  toOrder,
  toPayment,
  toProduct,
  toPurchase,
  toSupplyItem,
  type Cost,
  type Customer,
  type Delivery,
  type DeliveryStatus,
  type Order,
  type OrderItemRow,
  type OrderRow,
  type Payment,
  type Product,
  type Purchase,
  type SupplyItem,
} from "@bread/shared";

import { supabase } from "@/lib/supabase";

/**
 * Reading side of the data layer.
 *
 * The business logic in @bread/shared works on plain arrays — `buildReport` and
 * `customerAccount` take whole collections — so rather than rewriting that
 * logic as SQL, this loads the tables and hands them over unchanged. At this
 * scale (a bakery's day, not a warehouse) that is the right trade: the tested
 * logic stays in one place and is shared with the mobile app when it arrives.
 *
 * Each loader is wrapped in React's `cache`, so a page that calls five services
 * still makes one query per table, and every one of those services sees the
 * same consistent snapshot. Without that, two service calls in the same render
 * could disagree — an order present in one and missing from the other — and the
 * paid/unpaid badge would silently vanish rather than error.
 *
 * NOTE: never call a loader again after a write inside the same server action.
 * `cache` will hand back the pre-write snapshot.
 */

// Loud rather than wrong: if a table ever grows past this, the owner should see
// an error, not a quietly truncated month with an understated profit.
const ROW_LIMIT = 2000;

function assertNotTruncated(table: string, rows: readonly unknown[]): void {
  if (rows.length >= ROW_LIMIT) {
    throw new Error(
      `Loaded ${rows.length} rows from ${table}, which hits the ${ROW_LIMIT} row limit. ` +
        "Results would be silently incomplete — the data layer needs pagination before this point.",
    );
  }
}

function fail(table: string, message: string): never {
  throw new Error(`Could not load ${table}: ${message}`);
}

export const loadCustomers = cache(async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name")
    .limit(ROW_LIMIT);

  if (error) fail("customers", error.message);
  assertNotTruncated("customers", data ?? []);
  return (data ?? []).map(toCustomer);
});

/**
 * Unfiltered on purpose. `listProducts` applies the `active` filter for the
 * forms; everything else looks a product up by id to name it, and filtering
 * here would turn every order for a discontinued bread into "Unknown product".
 */
export const loadProducts = cache(async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name")
    .limit(ROW_LIMIT);

  if (error) fail("products", error.message);
  assertNotTruncated("products", data ?? []);
  return (data ?? []).map(toProduct);
});

export const loadDeliveries = cache(async (): Promise<Delivery[]> => {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .order("id")
    .limit(ROW_LIMIT);

  if (error) fail("deliveries", error.message);
  assertNotTruncated("deliveries", data ?? []);
  return (data ?? []).map(toDelivery);
});

/**
 * Orders carry their lines through a PostgREST embed, so this is one query.
 *
 * The embed is ordered by `position`, which is the order the customer put the
 * breads in the basket. Every line of an order is written in one statement, so
 * they share a `created_at` to the microsecond and ordering by that alone
 * leaves ties — the breads on an order would swap places between refreshes.
 *
 * An order's status comes from its delivery, so deliveries are loaded first.
 */
export const loadOrders = cache(async (): Promise<Order[]> => {
  const [{ data, error }, deliveries] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("delivery_date", { ascending: false })
      .order("position", { referencedTable: "order_items", ascending: true })
      .order("created_at", { referencedTable: "order_items", ascending: true })
      .limit(ROW_LIMIT),
    loadDeliveries(),
  ]);

  if (error) fail("orders", error.message);
  assertNotTruncated("orders", data ?? []);

  const statusByOrder = new Map<string, DeliveryStatus>(
    deliveries.map((delivery) => [delivery.orderId, delivery.status]),
  );

  type OrderRowWithItems = OrderRow & { order_items: OrderItemRow[] };

  return (data ?? [])
    .map((row) => row as OrderRowWithItems)
    // An order the customer never paid for was never a commitment, so it stays
    // off the owner's screen. Orders she wrote down herself are always real.
    .filter((row) => row.source === "admin" || row.payment_status !== "pending")
    .map((row) =>
      toOrder(row, row.order_items ?? [], statusByOrder.get(row.id) ?? "pending"),
    );
});

export const loadPayments = cache(async (): Promise<Payment[]> => {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(ROW_LIMIT);

  if (error) fail("payments", error.message);
  assertNotTruncated("payments", data ?? []);
  return (data ?? []).map(toPayment);
});

export const loadSupplyItems = cache(async (): Promise<SupplyItem[]> => {
  const { data, error } = await supabase
    .from("supply_items")
    .select("*")
    .order("name")
    .limit(ROW_LIMIT);

  if (error) fail("supply items", error.message);
  assertNotTruncated("supply_items", data ?? []);
  return (data ?? []).map(toSupplyItem);
});

export const loadPurchases = cache(async (): Promise<Purchase[]> => {
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .order("date", { ascending: false })
    .limit(ROW_LIMIT);

  if (error) fail("purchases", error.message);
  assertNotTruncated("purchases", data ?? []);
  return (data ?? []).map(toPurchase);
});

export const loadCosts = cache(async (): Promise<Cost[]> => {
  const { data, error } = await supabase
    .from("costs")
    .select("*")
    .order("date", { ascending: false })
    .limit(ROW_LIMIT);

  if (error) fail("costs", error.message);
  assertNotTruncated("costs", data ?? []);
  return (data ?? []).map(toCost);
});

export interface Store {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  deliveries: Delivery[];
  payments: Payment[];
  costs: Cost[];
  supplyItems: SupplyItem[];
  purchases: Purchase[];
}

/**
 * Everything at once, for the report. Prefer the individual loaders elsewhere —
 * the spending screen needs three tables, not eight.
 */
export const loadStore = cache(async (): Promise<Store> => {
  const [customers, products, orders, deliveries, payments, costs, supplyItems, purchases] =
    await Promise.all([
      loadCustomers(),
      loadProducts(),
      loadOrders(),
      loadDeliveries(),
      loadPayments(),
      loadCosts(),
      loadSupplyItems(),
      loadPurchases(),
    ]);

  return { customers, products, orders, deliveries, payments, costs, supplyItems, purchases };
});
