/**
 * The one place database rows become domain objects.
 *
 * The database is snake_case, the domain is camelCase, and both apps read the
 * same tables — so this mapping exists exactly once, here, rather than being
 * rewritten slightly differently in each app.
 *
 * Pure functions only. No Supabase client, no queries, no I/O, so this stays
 * usable from a browser and from a React Native runtime like everything else in
 * this package.
 */

import type {
  CostRow,
  CustomerRow,
  DeliveryRow,
  OrderItemRow,
  OrderRow,
  PaymentRow,
  ProductRow,
  PurchaseRow,
  SupplyItemRow,
} from "./database.types";
import { orderStatusForDelivery } from "./orders";
import type {
  Cost,
  Customer,
  Delivery,
  DeliveryStatus,
  Order,
  OrderLine,
  Payment,
  Product,
  Purchase,
  SupplyItem,
} from "./types";

/**
 * Postgres returns a timestamptz with whatever offset the connection implies.
 * Two places derive a business day by slicing the first ten characters off one
 * of these, so a non-UTC offset would file a payment under the wrong calendar
 * day — and therefore the wrong month on the reports screen — with no error.
 * Every timestamp passes through here so that cannot happen.
 */
function toIsoTimestamp(value: string): string {
  return new Date(value).toISOString();
}

function toIsoTimestampOrNull(value: string | null): string | null {
  return value === null ? null : toIsoTimestamp(value);
}

/**
 * Ghanaian numbers are written both ways: "+233 24 111 2233" and "0241112233"
 * are the same person. Mirrors the generated `phone_normalised` column in
 * supabase/migrations/0002 — if you change one, change both.
 */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
}

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    type: row.type,
    area: row.area,
    notes: row.notes ?? undefined,
    archivedAt: toIsoTimestampOrNull(row.archived_at),
  };
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    pricePesewas: row.price_pesewas,
    active: row.active,
  };
}

export function toOrderLine(row: OrderItemRow): OrderLine {
  return {
    id: row.id,
    productId: row.product_id,
    quantity: row.quantity,
    unitPricePesewas: row.unit_price_pesewas,
  };
}

/**
 * An order's status is derived, never stored: it follows from how the delivery
 * went, which is what `orderStatusForDelivery` already decides. Storing it too
 * would let the two disagree. Cancellation is the one state a delivery cannot
 * imply, so it is the one state the table records.
 */
export function toOrder(
  row: OrderRow,
  items: readonly OrderItemRow[],
  deliveryStatus: DeliveryStatus,
): Order {
  return {
    id: row.id,
    customerId: row.customer_id ?? "",
    deliveryDate: row.delivery_date,
    status: row.cancelled_at ? "cancelled" : orderStatusForDelivery(deliveryStatus),
    source: row.source,
    lines: items.map(toOrderLine),
    createdAt: toIsoTimestamp(row.created_at),
    rescheduledFrom: row.rescheduled_from,
  };
}

export function toDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    deliveredQuantity: row.delivered_quantity,
    deliveredAt: toIsoTimestampOrNull(row.delivered_at),
    note: row.note ?? undefined,
  };
}

export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    customerId: row.customer_id,
    orderId: row.order_id,
    amountPesewas: row.amount_pesewas,
    method: row.method,
    reference: row.reference ?? undefined,
    note: row.note ?? undefined,
    source: row.source,
    recordedAt: toIsoTimestamp(row.recorded_at),
    confirmedAt: toIsoTimestampOrNull(row.confirmed_at),
    rejectedAt: toIsoTimestampOrNull(row.rejected_at),
  };
}

export function toSupplyItem(row: SupplyItemRow): SupplyItem {
  return {
    id: row.id,
    name: row.name,
    defaultUnit: row.default_unit,
    category: row.category,
    active: row.active,
  };
}

export function toPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    itemId: row.item_id,
    date: row.date,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPricePesewas: row.unit_price_pesewas,
    supplier: row.supplier ?? undefined,
    note: row.note ?? undefined,
    recordedAt: toIsoTimestamp(row.recorded_at),
  };
}

export function toCost(row: CostRow): Cost {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    amountPesewas: row.amount_pesewas,
    note: row.note ?? undefined,
  };
}
