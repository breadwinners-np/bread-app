/**
 * Pure report building: revenue, costs, and sales over a stretch of days.
 *
 * Everything here is a pure function over domain arrays, so the same numbers
 * can be produced on the owner's laptop today and inside a scheduled job later
 * without either drifting from the other.
 *
 * Two things this deliberately does NOT do:
 *
 * - It does not call a supply's cost "cost of goods sold" for a particular
 *   loaf. Whether costs are a daily lump or allocated per batch is open
 *   (CST-3), so profit here is the plain difference between money earned and
 *   money spent over the same days, before wages.
 * - It does not decide when a cheque becomes revenue. Revenue is recognised on
 *   the day bread was delivered, and money received is reported separately, so
 *   the two can be compared rather than conflated (PAY-3).
 */

import {
  eachDay,
  formatDate,
  formatMonth,
  monthOf,
  startOfMonth,
  startOfWeek,
} from "./dates";
import { sumPesewas } from "./money";
import { orderQuantity } from "./orders";
import {
  customerAccount,
  isPaymentCounted,
  orderAmountDuePesewas,
} from "./payments";
import { purchaseTotalPesewas } from "./purchases";
import type {
  Cost,
  CostCategory,
  Customer,
  Delivery,
  Order,
  Payment,
  Product,
  Purchase,
  SupplyItem,
} from "./types";

export interface DateRange {
  /** ISO `YYYY-MM-DD`, inclusive. */
  from: string;
  /** ISO `YYYY-MM-DD`, inclusive. */
  to: string;
}

/** Everything a report reads. The caller fetches; this file only computes. */
export interface ReportInput {
  range: DateRange;
  orders: readonly Order[];
  deliveries: readonly Delivery[];
  payments: readonly Payment[];
  purchases: readonly Purchase[];
  supplyItems: readonly SupplyItem[];
  costs: readonly Cost[];
  products: readonly Product[];
  customers: readonly Customer[];
}

/** Days are grouped so a long range does not produce hundreds of columns. */
export type Granularity = "day" | "week" | "month";

export interface ReportBucket {
  /** ISO date the bucket starts on. */
  key: string;
  /** Short label for an axis, e.g. `12/07`. */
  label: string;
  revenuePesewas: number;
  costPesewas: number;
  quantityDelivered: number;
}

export interface RankedValue {
  key: string;
  label: string;
  valuePesewas: number;
  /** Loaves, sacks, or whatever the row counts. Omitted where meaningless. */
  quantity?: number;
}

export interface Report {
  range: DateRange;
  granularity: Granularity;
  buckets: ReportBucket[];

  /** Bread delivered in the range, valued at the prices on the orders. */
  revenuePesewas: number;
  /** Everything bought or spent in the range. */
  costPesewas: number;
  /** Revenue less costs, before wages (CST-3). */
  profitPesewas: number;
  /** Confirmed money that came in during the range, whenever it was earned. */
  paymentsReceivedPesewas: number;
  /** Of the bread delivered in this range, what is still unpaid. */
  outstandingPesewas: number;

  quantityDelivered: number;
  ordersDelivered: number;
  ordersFailed: number;

  byProduct: RankedValue[];
  byCostCategory: RankedValue[];
  byCustomer: RankedValue[];
}

export function isWithin(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

/** Named stretches of time the owner picks from, rather than typing dates. */
export type RangePresetId =
  | "today"
  | "last_7_days"
  | "this_month"
  | "last_month"
  | "custom";

export const RANGE_PRESETS: readonly { id: RangePresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];

export function resolveRangePreset(
  preset: RangePresetId,
  today: string,
): DateRange | null {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "last_7_days":
      return { from: shiftDays(today, -6), to: today };
    case "this_month":
      return { from: startOfMonth(today), to: today };
    case "last_month": {
      const firstOfThis = startOfMonth(today);
      const lastOfPrevious = shiftDays(firstOfThis, -1);
      return { from: startOfMonth(lastOfPrevious), to: lastOfPrevious };
    }
    case "custom":
      return null;
  }
}

/** Which preset a range corresponds to, so the right button reads as chosen. */
export function matchRangePreset(
  range: DateRange,
  today: string,
): RangePresetId {
  for (const preset of RANGE_PRESETS) {
    const candidate = resolveRangePreset(preset.id, today);
    if (candidate && candidate.from === range.from && candidate.to === range.to) {
      return preset.id;
    }
  }
  return "custom";
}

export function granularityFor(range: DateRange): Granularity {
  const days = eachDay(range.from, range.to).length;
  if (days <= 31) return "day";
  if (days <= 186) return "week";
  return "month";
}

export function buildReport(input: ReportInput): Report {
  const { range, orders, deliveries, payments, purchases, supplyItems, costs } =
    input;

  const deliveryFor = (order: Order) =>
    deliveries.find((entry) => entry.orderId === order.id);

  const ordersInRange = orders.filter((order) => isWithin(order.deliveryDate, range));

  // ---- Revenue, and what of it is still unpaid ---------------------------
  //
  // Revenue is recognised on the delivery day, which is the same rule the
  // balance uses (decision 0012), so "earned" and "owed" can never disagree.

  const revenueByOrder = new Map<string, number>();
  for (const order of ordersInRange) {
    revenueByOrder.set(order.id, orderAmountDuePesewas(order, deliveryFor(order)));
  }

  const revenuePesewas = sumPesewas([...revenueByOrder.values()]);

  const paidByOrder = paidPerOrder(orders, deliveries, payments);
  const outstandingPesewas = sumPesewas(
    [...revenueByOrder.entries()].map(([orderId, due]) =>
      Math.max(0, due - (paidByOrder.get(orderId) ?? 0)),
    ),
  );

  // ---- Costs ------------------------------------------------------------

  const purchasesInRange = purchases.filter((entry) => isWithin(entry.date, range));
  const costsInRange = costs.filter((entry) => isWithin(entry.date, range));

  const costPesewas =
    sumPesewas(purchasesInRange.map(purchaseTotalPesewas)) +
    sumPesewas(costsInRange.map((entry) => entry.amountPesewas));

  // ---- Money that actually came in --------------------------------------

  const paymentsReceivedPesewas = sumPesewas(
    payments
      .filter(isPaymentCounted)
      .filter((payment) => isWithin(payment.recordedAt.slice(0, 10), range))
      .map((payment) => payment.amountPesewas),
  );

  // ---- Buckets over time ------------------------------------------------

  const granularity = granularityFor(range);
  const buckets = new Map<string, ReportBucket>();

  for (const day of eachDay(range.from, range.to)) {
    const key = bucketKey(day, granularity);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: bucketLabel(key, granularity),
        revenuePesewas: 0,
        costPesewas: 0,
        quantityDelivered: 0,
      });
    }
  }

  const bucketFor = (day: string) => buckets.get(bucketKey(day, granularity));

  for (const order of ordersInRange) {
    const bucket = bucketFor(order.deliveryDate);
    if (!bucket) continue;
    bucket.revenuePesewas += revenueByOrder.get(order.id) ?? 0;
    bucket.quantityDelivered += deliveredQuantity(order, deliveryFor(order));
  }

  for (const entry of purchasesInRange) {
    const bucket = bucketFor(entry.date);
    if (bucket) bucket.costPesewas += purchaseTotalPesewas(entry);
  }

  for (const entry of costsInRange) {
    const bucket = bucketFor(entry.date);
    if (bucket) bucket.costPesewas += entry.amountPesewas;
  }

  // ---- Breakdowns -------------------------------------------------------

  const byProduct = rankProducts(input, ordersInRange, deliveryFor);
  const byCostCategory = rankCostCategories(purchasesInRange, costsInRange, supplyItems);
  const byCustomer = rankCustomers(input, ordersInRange, revenueByOrder);

  const delivered = ordersInRange.filter((order) => {
    const delivery = deliveryFor(order);
    return delivery?.status === "delivered" || delivery?.status === "partial";
  });

  return {
    range,
    granularity,
    buckets: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)),
    revenuePesewas,
    costPesewas,
    profitPesewas: revenuePesewas - costPesewas,
    paymentsReceivedPesewas,
    outstandingPesewas,
    quantityDelivered: sumPesewas(
      ordersInRange.map((order) => deliveredQuantity(order, deliveryFor(order))),
    ),
    ordersDelivered: delivered.length,
    ordersFailed: ordersInRange.filter(
      (order) => deliveryFor(order)?.status === "not_delivered",
    ).length,
    byProduct,
    byCostCategory,
    byCustomer,
  };
}

/**
 * A one-paragraph summary in the owner's own terms.
 *
 * Reports are read by someone who wants an answer, not a dataset. The charts
 * carry the detail; this says what happened.
 */
export function summariseReport(
  report: Report,
  formatMoney: (pesewas: number) => string,
): string[] {
  const sentences: string[] = [];
  const days = eachDay(report.range.from, report.range.to).length;
  // "on 28/07/2026" or "between 01/07/2026 and 28/07/2026" — both read as
  // ordinary sentences wherever they land.
  const period =
    report.range.from === report.range.to
      ? `on ${formatDate(report.range.from)}`
      : `between ${formatDate(report.range.from)} and ${formatDate(report.range.to)}`;

  if (report.quantityDelivered === 0) {
    sentences.push(`No bread was delivered ${period}.`);
  } else {
    sentences.push(
      `You delivered ${report.quantityDelivered.toLocaleString("en-US")} ` +
        `${report.quantityDelivered === 1 ? "loaf" : "loaves"} ${period}, across ` +
        `${report.ordersDelivered} ${report.ordersDelivered === 1 ? "order" : "orders"}, ` +
        `worth ${formatMoney(report.revenuePesewas)}.`,
    );
  }

  sentences.push(
    `You spent ${formatMoney(report.costPesewas)} on gas, ingredients and transport, ` +
      `which leaves ${formatMoney(report.profitPesewas)} before wages.`,
  );

  if (report.outstandingPesewas > 0) {
    sentences.push(
      `${formatMoney(report.outstandingPesewas)} of that bread has not been paid for yet.`,
    );
  } else if (report.revenuePesewas > 0) {
    sentences.push("Every delivery in this period has been paid for.");
  }

  const best = report.byProduct[0];
  if (best && best.quantity) {
    sentences.push(
      `${best.label} sold most, at ${best.quantity.toLocaleString("en-US")} ` +
        `${best.quantity === 1 ? "loaf" : "loaves"}.`,
    );
  }

  if (report.ordersFailed > 0) {
    sentences.push(
      `${report.ordersFailed} ${report.ordersFailed === 1 ? "delivery" : "deliveries"} ` +
        `could not be made, and ${report.ordersFailed === 1 ? "it is" : "they are"} not counted as money earned.`,
    );
  }

  if (days > 1 && report.quantityDelivered > 0) {
    sentences.push(
      `Across those ${days} days that is ` +
        `${Math.round(report.quantityDelivered / days).toLocaleString("en-US")} loaves a day on average.`,
    );
  }

  return sentences;
}

/* ------------------------------------------------------------------------ */

function shiftDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function deliveredQuantity(order: Order, delivery: Delivery | undefined): number {
  if (!delivery || order.status === "cancelled") return 0;
  if (delivery.status === "delivered") return orderQuantity(order);
  if (delivery.status === "partial") return delivery.deliveredQuantity;
  return 0;
}

function bucketKey(day: string, granularity: Granularity): string {
  if (granularity === "day") return day;
  if (granularity === "week") return startOfWeek(day);
  return startOfMonth(day);
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === "month") return formatMonth(monthOf(key));
  return formatDate(key).slice(0, 5);
}

/**
 * What has been paid against each order, across every customer.
 *
 * Payments are allocated per customer — a payment can only ever settle the
 * orders of the customer who made it — so this groups first and reuses the same
 * oldest-first rule the balance uses.
 */
function paidPerOrder(
  orders: readonly Order[],
  deliveries: readonly Delivery[],
  payments: readonly Payment[],
): Map<string, number> {
  const paid = new Map<string, number>();
  const customerIds = new Set(orders.map((order) => order.customerId));

  for (const customerId of customerIds) {
    const account = customerAccount(
      orders.filter((order) => order.customerId === customerId),
      deliveries,
      payments.filter((payment) => payment.customerId === customerId),
    );

    for (const line of account.lines) {
      paid.set(line.order.id, line.paidPesewas);
    }
  }

  return paid;
}

function rankProducts(
  input: ReportInput,
  ordersInRange: readonly Order[],
  deliveryFor: (order: Order) => Delivery | undefined,
): RankedValue[] {
  const totals = new Map<string, { value: number; quantity: number }>();

  for (const order of ordersInRange) {
    const delivery = deliveryFor(order);
    let remaining = deliveredQuantity(order, delivery);
    if (remaining <= 0) continue;

    for (const line of order.lines) {
      if (remaining <= 0) break;
      const taken = Math.min(line.quantity, remaining);
      remaining -= taken;

      const entry = totals.get(line.productId) ?? { value: 0, quantity: 0 };
      entry.value += taken * line.unitPricePesewas;
      entry.quantity += taken;
      totals.set(line.productId, entry);
    }
  }

  return [...totals.entries()]
    .map(([productId, entry]) => ({
      key: productId,
      label:
        input.products.find((product) => product.id === productId)?.name ??
        "Unknown bread",
      valuePesewas: entry.value,
      quantity: entry.quantity,
    }))
    .sort((a, b) => b.valuePesewas - a.valuePesewas);
}

function rankCostCategories(
  purchases: readonly Purchase[],
  costs: readonly Cost[],
  supplyItems: readonly SupplyItem[],
): RankedValue[] {
  const totals: Record<CostCategory, number> = {
    gas: 0,
    ingredients: 0,
    transport: 0,
  };

  for (const entry of purchases) {
    const item = supplyItems.find((supply) => supply.id === entry.itemId);
    if (item) totals[item.category] += purchaseTotalPesewas(entry);
  }

  for (const entry of costs) {
    totals[entry.category] += entry.amountPesewas;
  }

  return (Object.keys(totals) as CostCategory[])
    .map((category) => ({
      key: category,
      label: category,
      valuePesewas: totals[category],
    }))
    .filter((entry) => entry.valuePesewas > 0)
    .sort((a, b) => b.valuePesewas - a.valuePesewas);
}

function rankCustomers(
  input: ReportInput,
  ordersInRange: readonly Order[],
  revenueByOrder: Map<string, number>,
): RankedValue[] {
  const totals = new Map<string, number>();

  for (const order of ordersInRange) {
    const value = revenueByOrder.get(order.id) ?? 0;
    if (value <= 0) continue;
    totals.set(order.customerId, (totals.get(order.customerId) ?? 0) + value);
  }

  return [...totals.entries()]
    .map(([customerId, value]) => ({
      key: customerId,
      label:
        input.customers.find((customer) => customer.id === customerId)?.name ??
        "Unknown customer",
      valuePesewas: value,
    }))
    .sort((a, b) => b.valuePesewas - a.valuePesewas);
}
