/**
 * Delivery service — the daily distribution round.
 *
 * This is the flow that has to work offline on the mobile side (DST-3). Here on
 * the laptop it is a plain server call, but the shape is deliberately simple:
 * read a day's list, record one outcome at a time.
 */

import {
  daysBetween,
  monthOf,
  orderQuantity,
  outstandingReason,
  resolveDeliveredLines,
  todayIso,
  type DeliveryListItem,
  type OutstandingReason,
  type RecordDeliveryInput,
  type RescheduleDeliveryInput,
} from "@bread/shared";

import { supabase } from "@/lib/supabase";
import { loadCustomers, loadDeliveries, loadOrders } from "./loaders";

/** A delivery that still needs the owner to do something about it. */
export interface OutstandingDelivery extends DeliveryListItem {
  reason: OutstandingReason;
  /** Whole days between the day it was due and today. */
  daysLate: number;
}

/** One day's round, as a calendar cell needs it. */
export interface DeliveryDaySummary {
  date: string;
  /** Drops planned for that day. */
  total: number;
  /** Delivered in full or in part. */
  done: number;
  /** Someone tried and could not deliver. */
  failed: number;
  quantity: number;
}

/**
 * Every day in a month that has deliveries on it, keyed by day.
 *
 * This is what somebody standing in for the owner reads first: which days have
 * bread going out, and which of those still need doing.
 */
export async function listDeliveryDaysForMonth(
  month: string,
): Promise<Record<string, DeliveryDaySummary>> {
  const [orders, deliveries] = await Promise.all([loadOrders(), loadDeliveries()]);
  const days: Record<string, DeliveryDaySummary> = {};

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    if (monthOf(order.deliveryDate) !== month) continue;

    const delivery = deliveries.find((entry) => entry.orderId === order.id);
    if (!delivery) continue;

    const day = (days[order.deliveryDate] ??= {
      date: order.deliveryDate,
      total: 0,
      done: 0,
      failed: 0,
      quantity: 0,
    });

    day.total += 1;
    day.quantity += orderQuantity(order);
    if (delivery.status === "delivered" || delivery.status === "partial") {
      day.done += 1;
    }
    if (delivery.status === "not_delivered") day.failed += 1;
  }

  return days;
}

export async function listDeliveriesForDate(
  date: string,
): Promise<DeliveryListItem[]> {
  const [orders, deliveries, customers] = await Promise.all([
    loadOrders(),
    loadDeliveries(),
    loadCustomers(),
  ]);

  return orders
    .filter((order) => order.deliveryDate === date && order.status !== "cancelled")
    .map((order) => {
      const delivery = deliveries.find((entry) => entry.orderId === order.id);
      const customer = customers.find((entry) => entry.id === order.customerId);

      if (!delivery || !customer) return null;

      return {
        order,
        customer,
        delivery,
        orderedQuantity: orderQuantity(order),
      } satisfies DeliveryListItem;
    })
    .filter((item): item is DeliveryListItem => item !== null)
    .sort((a, b) => a.customer.name.localeCompare(b.customer.name));
}

/**
 * Every delivery that failed or was never recorded, oldest first.
 *
 * Deliberately not date-scoped: the point of this list is that these fell
 * through the cracks of the daily round, so scoping it to a day would hide
 * exactly the ones that matter.
 */
export async function listOutstandingDeliveries(): Promise<OutstandingDelivery[]> {
  const [orders, deliveries, customers] = await Promise.all([
    loadOrders(),
    loadDeliveries(),
    loadCustomers(),
  ]);
  const today = todayIso();

  return orders
    .map((order) => {
      const delivery = deliveries.find((entry) => entry.orderId === order.id);
      const customer = customers.find((entry) => entry.id === order.customerId);
      if (!delivery || !customer) return null;

      const reason = outstandingReason(order, delivery, today);
      if (!reason) return null;

      return {
        order,
        customer,
        delivery,
        orderedQuantity: orderQuantity(order),
        reason,
        daysLate: daysBetween(order.deliveryDate, today),
      } satisfies OutstandingDelivery;
    })
    .filter((item): item is OutstandingDelivery => item !== null)
    .sort((a, b) => a.order.deliveryDate.localeCompare(b.order.deliveryDate));
}

/**
 * Move a delivery to a later day.
 *
 * The order itself moves, rather than a second order being created, so one
 * order stays equal to one obligation and a rescheduled drop is never billed
 * twice. The original date is kept on the order so the move is visible.
 *
 * The order's status is not written: it follows from the delivery going back to
 * pending, which reads as scheduled again.
 *
 * OPEN: whether each attempt should survive as its own record, and whether a
 * repeatedly-failed delivery is eventually written off, are undecided. See the
 * open questions in DECISIONS.md.
 */
export async function rescheduleDelivery(
  input: RescheduleDeliveryInput,
): Promise<void> {
  const [orders, deliveries] = await Promise.all([loadOrders(), loadDeliveries()]);

  const order = orders.find((entry) => entry.id === input.orderId);
  const delivery = deliveries.find((entry) => entry.orderId === input.orderId);

  // Checked here rather than left to the update, because an UPDATE against a
  // row that does not exist succeeds with nothing changed.
  if (!order || !delivery) {
    throw new Error("That delivery does not exist");
  }

  if (input.newDate <= order.deliveryDate) {
    throw new Error("Pick a day after the one it was originally due");
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      rescheduled_from: order.rescheduledFrom ?? order.deliveryDate,
      delivery_date: input.newDate,
    })
    .eq("id", order.id);

  if (orderError) throw new Error(`Could not move the delivery: ${orderError.message}`);

  const { error: deliveryError } = await supabase
    .from("deliveries")
    .update({ status: "pending", delivered_quantity: 0, delivered_at: null })
    .eq("order_id", order.id);

  if (deliveryError) {
    throw new Error(`Could not move the delivery: ${deliveryError.message}`);
  }
}

/**
 * Record what happened to one delivery.
 *
 * The stored quantities are derived rather than taken on trust — see
 * `resolveDeliveredLines` in @bread/shared, which owns that rule so the mobile
 * app cannot arrive at a different answer.
 *
 * One RPC because this now writes two tables: how much of each bread arrived,
 * and the delivery itself. A failure between the two would leave a delivery
 * marked done whose breads still read as undelivered, and the customer's
 * balance would quietly disagree with the screen.
 */
export async function recordDelivery(input: RecordDeliveryInput): Promise<void> {
  const [orders, deliveries] = await Promise.all([loadOrders(), loadDeliveries()]);

  const delivery = deliveries.find((entry) => entry.orderId === input.orderId);
  const order = orders.find((entry) => entry.id === input.orderId);

  if (!delivery || !order) {
    throw new Error("That delivery does not exist");
  }

  const lines = resolveDeliveredLines(input.status, input.deliveredByLine, order);

  const { error } = await supabase.rpc("record_delivery", {
    p_order_id: input.orderId,
    p_status: input.status,
    p_lines: lines.map((line) => ({
      order_item_id: line.orderLineId,
      quantity: line.quantity,
    })),
    p_note: input.note ?? null,
  });

  if (error) throw new Error(`Could not record the delivery: ${error.message}`);
}
