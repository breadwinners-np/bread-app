/**
 * In-memory data store for the prototype.
 *
 * THIS IS TEMPORARY. It exists so the admin app can be clicked through before
 * the database schema is settled — the schema is blocked on four business
 * questions (see the open questions in DECISIONS.md).
 *
 * Everything the screens use goes through the service modules beside this file.
 * When Supabase arrives, those service functions get reimplemented against it
 * and this file is deleted. No screen should ever import this module directly.
 *
 * State lives on globalThis so it survives Next's hot reload in development.
 * It resets when the server restarts, which is fine for a prototype.
 */

import {
  addDays,
  todayIso,
  type Cost,
  type Customer,
  type Delivery,
  type Order,
  type Payment,
  type Product,
} from "@bread/shared";

export interface Store {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  deliveries: Delivery[];
  payments: Payment[];
  costs: Cost[];
}

function seed(): Store {
  const today = todayIso();
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const tomorrow = addDays(today, 1);

  const products: Product[] = [
    { id: "prd-1", name: "Sugar bread", unit: "loaf", pricePesewas: 1200, active: true },
    { id: "prd-2", name: "Tea bread", unit: "loaf", pricePesewas: 1000, active: true },
    { id: "prd-3", name: "Butter bread", unit: "loaf", pricePesewas: 1800, active: true },
  ];

  const customers: Customer[] = [
    {
      id: "cus-1",
      name: "Barcelona Total",
      phone: "+233 24 111 2233",
      type: "business",
      area: "Osu",
      notes: "Monthly agreement, pays by cheque. Delivery before 7am.",
    },
    {
      id: "cus-2",
      name: "Adom Provisions",
      phone: "+233 20 444 5566",
      type: "business",
      area: "Madina",
      notes: "Confirms quantity by text each month.",
    },
    {
      id: "cus-3",
      name: "Grace Mensah",
      phone: "+233 55 777 8899",
      type: "individual",
      area: "Labone",
    },
    {
      id: "cus-4",
      name: "Kofi Owusu",
      phone: "+233 26 222 3344",
      type: "individual",
      area: "East Legon",
    },
    {
      id: "cus-5",
      name: "Akosua Boateng",
      phone: "+233 27 888 1122",
      type: "individual",
      area: "Cantonments",
      notes: "Prefers butter bread.",
    },
  ];

  const orders: Order[] = [
    // Today
    order("ord-1", "cus-1", today, "scheduled", "admin", "prd-1", 120, 1200),
    order("ord-2", "cus-2", today, "scheduled", "admin", "prd-2", 60, 1000),
    order("ord-3", "cus-3", today, "scheduled", "app", "prd-1", 6, 1200),
    order("ord-4", "cus-4", today, "scheduled", "app", "prd-3", 4, 1800),
    order("ord-5", "cus-5", today, "scheduled", "admin", "prd-3", 10, 1800),
    // Tomorrow
    order("ord-6", "cus-1", tomorrow, "scheduled", "admin", "prd-1", 120, 1200),
    order("ord-7", "cus-3", tomorrow, "scheduled", "app", "prd-2", 8, 1000),
    // Yesterday — already delivered
    order("ord-8", "cus-1", yesterday, "delivered", "admin", "prd-1", 120, 1200),
    order("ord-9", "cus-2", yesterday, "partially_delivered", "admin", "prd-2", 60, 1000),
    order("ord-10", "cus-5", yesterday, "delivered", "admin", "prd-3", 10, 1800),
    // Two days ago
    order("ord-11", "cus-1", twoDaysAgo, "delivered", "admin", "prd-1", 120, 1200),
    order("ord-12", "cus-4", twoDaysAgo, "delivered", "app", "prd-1", 5, 1200),
  ];

  const deliveries: Delivery[] = [
    // Today — one already done, the rest still to go
    delivery("dlv-1", "ord-1", "delivered", 120, `${today}T05:40:00Z`),
    delivery("dlv-2", "ord-2", "pending", 0, null),
    delivery("dlv-3", "ord-3", "pending", 0, null),
    delivery("dlv-4", "ord-4", "pending", 0, null),
    delivery("dlv-5", "ord-5", "pending", 0, null),
    // Tomorrow
    delivery("dlv-6", "ord-6", "pending", 0, null),
    delivery("dlv-7", "ord-7", "pending", 0, null),
    // Yesterday
    delivery("dlv-8", "ord-8", "delivered", 120, `${yesterday}T05:35:00Z`),
    delivery("dlv-9", "ord-9", "partial", 45, `${yesterday}T06:10:00Z`, "Shop was closed, left what they took"),
    delivery("dlv-10", "ord-10", "delivered", 10, `${yesterday}T06:50:00Z`),
    // Two days ago
    delivery("dlv-11", "ord-11", "delivered", 120, `${twoDaysAgo}T05:30:00Z`),
    delivery("dlv-12", "ord-12", "delivered", 5, `${twoDaysAgo}T07:05:00Z`),
  ];

  const payments: Payment[] = [
    {
      id: "pay-1",
      customerId: "cus-1",
      amountPesewas: 288000,
      method: "cheque",
      reference: "Cheque 004821 — GCB",
      recordedAt: `${twoDaysAgo}T10:00:00Z`,
    },
    {
      id: "pay-2",
      customerId: "cus-3",
      amountPesewas: 7200,
      method: "mobile_money",
      reference: "MoMo 8891",
      recordedAt: `${yesterday}T09:15:00Z`,
    },
    {
      id: "pay-3",
      customerId: "cus-5",
      amountPesewas: 18000,
      method: "cash",
      recordedAt: `${yesterday}T07:00:00Z`,
    },
  ];

  const costs: Cost[] = [
    { id: "cst-1", date: today, category: "gas", amountPesewas: 45000, note: "Furnace refill" },
    { id: "cst-2", date: today, category: "ingredients", amountPesewas: 120000, note: "Flour, 4 sacks" },
    { id: "cst-3", date: today, category: "transport", amountPesewas: 18000, note: "Fuel for the van" },
    { id: "cst-4", date: yesterday, category: "ingredients", amountPesewas: 95000, note: "Yeast, butter, sugar" },
    { id: "cst-5", date: yesterday, category: "transport", amountPesewas: 16000 },
    { id: "cst-6", date: twoDaysAgo, category: "gas", amountPesewas: 45000 },
  ];

  return { customers, products, orders, deliveries, payments, costs };
}

function order(
  id: string,
  customerId: string,
  deliveryDate: string,
  status: Order["status"],
  source: Order["source"],
  productId: string,
  quantity: number,
  unitPricePesewas: number,
): Order {
  return {
    id,
    customerId,
    deliveryDate,
    status,
    source,
    createdAt: `${deliveryDate}T00:00:00Z`,
    lines: [{ id: `${id}-l1`, productId, quantity, unitPricePesewas }],
  };
}

function delivery(
  id: string,
  orderId: string,
  status: Delivery["status"],
  deliveredQuantity: number,
  deliveredAt: string | null,
  note?: string,
): Delivery {
  return { id, orderId, status, deliveredQuantity, deliveredAt, note };
}

declare global {
  var __breadStore: Store | undefined;
}

export function getStore(): Store {
  if (!globalThis.__breadStore) {
    globalThis.__breadStore = seed();
  }
  return globalThis.__breadStore;
}

/** Stand-in for a database-generated id. */
export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Mimics the latency of a real query, so loading states are honest. */
export async function simulateLatency<T>(value: T): Promise<T> {
  return value;
}
