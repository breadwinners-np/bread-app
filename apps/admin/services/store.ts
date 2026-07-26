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
  type Purchase,
  type SupplyItem,
} from "@bread/shared";

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

function seed(): Store {
  const today = todayIso();
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const fourDaysAgo = addDays(today, -4);
  const tomorrow = addDays(today, 1);

  // Prices are placeholders. Whether there is one price list or a price
  // negotiated per wholesale customer is still open (PRD-4).
  const products: Product[] = [
    { id: "prd-sugar", name: "Sugar bread", unit: "loaf", pricePesewas: 1200, active: true },
    { id: "prd-butter", name: "Butter bread", unit: "loaf", pricePesewas: 1800, active: true },
    { id: "prd-mixfruit", name: "Mixfruit bread", unit: "loaf", pricePesewas: 2500, active: true },
    { id: "prd-brown", name: "Brown bread", unit: "loaf", pricePesewas: 1500, active: true },
  ];

  const customers: Customer[] = [
    {
      id: "cus-1",
      name: "Baatsonaa Total",
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
    order("ord-1", "cus-1", today, "scheduled", "admin", [
      ["prd-sugar", 120, 1200],
      ["prd-brown", 40, 1500],
    ]),
    order("ord-2", "cus-2", today, "scheduled", "admin", [
      ["prd-sugar", 40, 1200],
      ["prd-butter", 20, 1800],
    ]),
    order("ord-3", "cus-3", today, "scheduled", "app", [["prd-sugar", 6, 1200]]),
    order("ord-4", "cus-4", today, "scheduled", "app", [
      ["prd-butter", 4, 1800],
      ["prd-mixfruit", 2, 2500],
    ]),
    order("ord-5", "cus-5", today, "scheduled", "admin", [
      ["prd-mixfruit", 6, 2500],
      ["prd-butter", 4, 1800],
    ]),
    // Tomorrow
    order("ord-6", "cus-1", tomorrow, "scheduled", "admin", [
      ["prd-sugar", 120, 1200],
      ["prd-brown", 40, 1500],
    ]),
    order("ord-7", "cus-3", tomorrow, "scheduled", "app", [
      ["prd-brown", 8, 1500],
    ]),
    // Yesterday — already delivered
    order("ord-8", "cus-1", yesterday, "delivered", "admin", [
      ["prd-sugar", 120, 1200],
      ["prd-brown", 40, 1500],
    ]),
    order("ord-9", "cus-2", yesterday, "partially_delivered", "admin", [
      ["prd-sugar", 40, 1200],
      ["prd-butter", 20, 1800],
    ]),
    order("ord-10", "cus-5", yesterday, "delivered", "admin", [
      ["prd-mixfruit", 6, 2500],
    ]),
    // Two days ago
    order("ord-11", "cus-1", twoDaysAgo, "delivered", "admin", [
      ["prd-sugar", 120, 1200],
      ["prd-brown", 40, 1500],
    ]),
    order("ord-12", "cus-4", twoDaysAgo, "delivered", "app", [
      ["prd-sugar", 5, 1200],
    ]),
    // Needs attention: nobody was there to receive it
    order("ord-13", "cus-5", twoDaysAgo, "scheduled", "admin", [
      ["prd-butter", 8, 1800],
      ["prd-mixfruit", 4, 2500],
    ]),
    // Needs attention: the day passed and nothing was ever recorded
    order("ord-14", "cus-3", fourDaysAgo, "scheduled", "app", [
      ["prd-brown", 8, 1500],
    ]),
  ];

  const deliveries: Delivery[] = [
    // Today — one already done, the rest still to go
    fullDelivery("dlv-1", "ord-1", orders, `${today}T05:40:00Z`),
    pendingDelivery("dlv-2", "ord-2", orders),
    pendingDelivery("dlv-3", "ord-3", orders),
    pendingDelivery("dlv-4", "ord-4", orders),
    pendingDelivery("dlv-5", "ord-5", orders),
    // Tomorrow
    pendingDelivery("dlv-6", "ord-6", orders),
    pendingDelivery("dlv-7", "ord-7", orders),
    // Yesterday
    fullDelivery("dlv-8", "ord-8", orders, `${yesterday}T05:35:00Z`),
    // Short on butter only — the reason per-line quantities matter
    delivery(
      "dlv-9",
      "ord-9",
      "partial",
      [
        ["ord-9-l1", 40],
        ["ord-9-l2", 5],
      ],
      `${yesterday}T06:10:00Z`,
      "Shop was closed, they only took what they could store",
    ),
    fullDelivery("dlv-10", "ord-10", orders, `${yesterday}T06:50:00Z`),
    // Two days ago
    fullDelivery("dlv-11", "ord-11", orders, `${twoDaysAgo}T05:30:00Z`),
    fullDelivery("dlv-12", "ord-12", orders, `${twoDaysAgo}T07:05:00Z`),
    delivery(
      "dlv-13",
      "ord-13",
      "not_delivered",
      [
        ["ord-13-l1", 0],
        ["ord-13-l2", 0],
      ],
      `${twoDaysAgo}T06:20:00Z`,
      "Nobody at the house, phone off",
    ),
    // Never recorded at all — the round moved on and this was missed
    pendingDelivery("dlv-14", "ord-14", orders),
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

  // Costs that have no countable item. Anything bought by the sack, kilo, or
  // cylinder is a purchase instead, so nothing is counted in both places.
  const costs: Cost[] = [
    { id: "cst-1", date: today, category: "transport", amountPesewas: 18000, note: "Fuel for the van" },
    { id: "cst-2", date: yesterday, category: "transport", amountPesewas: 16000 },
    { id: "cst-3", date: twoDaysAgo, category: "transport", amountPesewas: 17000, note: "Fuel for the van" },
  ];

  const supplyItems: SupplyItem[] = [
    { id: "sup-1", name: "Flour", defaultUnit: "sack", category: "ingredients", active: true },
    { id: "sup-2", name: "Yeast", defaultUnit: "kg", category: "ingredients", active: true },
    { id: "sup-3", name: "Butter", defaultUnit: "kg", category: "ingredients", active: true },
    { id: "sup-4", name: "Sugar", defaultUnit: "kg", category: "ingredients", active: true },
    { id: "sup-5", name: "Salt", defaultUnit: "kg", category: "ingredients", active: true },
    { id: "sup-6", name: "Gas cylinder", defaultUnit: "piece", category: "gas", active: true },
  ];

  const purchases: Purchase[] = [
    purchase("pur-1", "sup-1", today, 4, "sack", 30000, "Kwame's Mill"),
    purchase("pur-2", "sup-6", today, 1, "piece", 45000, "Total Baatsonaa", "Furnace refill"),
    purchase("pur-3", "sup-2", yesterday, 2, "kg", 9000, "Makola market"),
    purchase("pur-4", "sup-3", yesterday, 5, "kg", 6000, "Makola market"),
    purchase("pur-5", "sup-4", yesterday, 25, "kg", 1800, "Makola market"),
    purchase("pur-6", "sup-5", yesterday, 2, "kg", 800, "Makola market"),
    purchase("pur-7", "sup-1", twoDaysAgo, 4, "sack", 29500, "Kwame's Mill", "Price was lower this week"),
    purchase("pur-8", "sup-6", twoDaysAgo, 1, "piece", 45000, "Total Baatsonaa"),
  ];

  return {
    customers,
    products,
    orders,
    deliveries,
    payments,
    costs,
    supplyItems,
    purchases,
  };
}

function purchase(
  id: string,
  itemId: string,
  date: string,
  quantity: number,
  unit: Purchase["unit"],
  unitPricePesewas: number,
  supplier?: string,
  note?: string,
): Purchase {
  return {
    id,
    itemId,
    date,
    quantity,
    unit,
    unitPricePesewas,
    supplier,
    note,
    recordedAt: `${date}T08:00:00Z`,
  };
}

/** `lines` is [productId, quantity, unitPricePesewas] per kind of bread. */
function order(
  id: string,
  customerId: string,
  deliveryDate: string,
  status: Order["status"],
  source: Order["source"],
  lines: [string, number, number][],
): Order {
  return {
    id,
    customerId,
    deliveryDate,
    status,
    source,
    createdAt: `${deliveryDate}T00:00:00Z`,
    lines: lines.map(([productId, quantity, unitPricePesewas], index) => ({
      id: `${id}-l${index + 1}`,
      productId,
      quantity,
      unitPricePesewas,
    })),
  };
}

/** `lines` is [orderLineId, deliveredQuantity]. */
function delivery(
  id: string,
  orderId: string,
  status: Delivery["status"],
  lines: [string, number][],
  deliveredAt: string | null,
  note?: string,
): Delivery {
  return {
    id,
    orderId,
    status,
    lines: lines.map(([orderLineId, deliveredQuantity]) => ({
      orderLineId,
      deliveredQuantity,
    })),
    deliveredAt,
    note,
  };
}

/** Every line delivered in full, read off the order so the two cannot drift. */
function fullDelivery(
  id: string,
  orderId: string,
  orders: Order[],
  deliveredAt: string,
): Delivery {
  const source = orders.find((entry) => entry.id === orderId);
  return delivery(
    id,
    orderId,
    "delivered",
    (source?.lines ?? []).map((line) => [line.id, line.quantity]),
    deliveredAt,
  );
}

/** Nothing recorded yet — one zero entry per line of the order. */
function pendingDelivery(
  id: string,
  orderId: string,
  orders: Order[],
): Delivery {
  const source = orders.find((entry) => entry.id === orderId);
  return delivery(
    id,
    orderId,
    "pending",
    (source?.lines ?? []).map((line) => [line.id, 0]),
    null,
  );
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
