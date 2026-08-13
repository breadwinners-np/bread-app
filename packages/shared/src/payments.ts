/**
 * Pure logic for what a customer owes and what they have paid.
 *
 * Two rules drive everything here, and both are provisional — they are the
 * cheapest possible answers to open questions, isolated in this file so that
 * changing them later is a small edit rather than an archaeology project.
 *
 * 1. **An order is owed once it has been delivered.** Bread that has not left
 *    the bakery is not money owed, so a scheduled order counts as "expected",
 *    not "due". See decision 0012.
 *
 * 2. **A part delivery is owed for what actually arrived.** OPEN (DST-7) —
 *    whether a short drop reduces what the customer owes is genuinely undecided.
 *    Charging for bread nobody received is the more damaging way to be wrong, so
 *    that is the side this errs on. `orderAmountDuePesewas` is the single place
 *    that decides it.
 *
 * Money is integer pesewas throughout (decision 0004).
 */

import { sumPesewas } from "./money";
import { orderTotalPesewas } from "./orders";
import type { Delivery, Order, Payment } from "./types";

/**
 * Whether a payment counts against a balance.
 *
 * A payment the owner recorded herself is confirmed as she saves it. One
 * reported from a customer's phone arrives unconfirmed and counts for nothing
 * until she agrees the money arrived — a claim is not cash (decision 0013).
 *
 * OPEN (PAY-3): a cheque counts from the day it is recorded, because whether a
 * cheque is paid on receipt or on clearing is undecided. When that is answered,
 * this function is where the cheque state belongs.
 */
export function isPaymentCounted(payment: Payment): boolean {
  return Boolean(payment.confirmedAt) && !payment.rejectedAt;
}

/** A payment reported from a customer's phone that the owner has not ruled on. */
export function isAwaitingConfirmation(payment: Payment): boolean {
  return !payment.confirmedAt && !payment.rejectedAt;
}

/**
 * What arrived, valued at the order's snapshotted prices.
 *
 * Each bread carries its own delivered quantity, so this is exact even when an
 * order holds several breads at different prices. It used to fill the lines in
 * order from a single total, which was only exact while an order held one
 * bread (decision 0010, superseded by 0026).
 */
export function deliveredValuePesewas(order: Order): number {
  return sumPesewas(
    order.lines.map((line) => line.deliveredQuantity * line.unitPricePesewas),
  );
}

/** What an order is owed right now, given how its delivery went. */
export function orderAmountDuePesewas(
  order: Order,
  delivery: Delivery | undefined,
): number {
  if (order.status === "cancelled" || !delivery) return 0;

  switch (delivery.status) {
    case "delivered":
      return orderTotalPesewas(order);
    case "partial":
      return deliveredValuePesewas(order);
    case "not_delivered":
    case "pending":
      // Nothing arrived, so nothing is owed yet. If it is rescheduled the same
      // order becomes due on the day it lands.
      return 0;
  }
}

export type OrderPaymentState =
  /** Not delivered yet, so not owed yet. */
  | "not_due"
  | "unpaid"
  | "part_paid"
  | "paid";

/** One order, with what it is owed and what has been put against it. */
export interface OrderAccountLine {
  order: Order;
  delivery: Delivery | undefined;
  duePesewas: number;
  paidPesewas: number;
  outstandingPesewas: number;
  state: OrderPaymentState;
}

/** A customer's whole position: what is owed, paid, coming, and unconfirmed. */
export interface CustomerAccount {
  /** Delivered and therefore owed. */
  duePesewas: number;
  /** Confirmed money received. */
  paidPesewas: number;
  /** `duePesewas - paidPesewas`. Positive means the customer owes. */
  balancePesewas: number;
  /** Ordered but not delivered yet — expected, not owed. */
  notYetDuePesewas: number;
  /** Paid more than they owe, so it sits waiting for the next delivery. */
  creditPesewas: number;
  /** Reported from the customer's phone and not yet confirmed by the owner. */
  awaitingConfirmationPesewas: number;
  lines: OrderAccountLine[];
}

/**
 * Spread a customer's payments across their orders.
 *
 * A payment tied to an order pays that order first. Anything left over — an
 * overpayment, or a lump sum like a monthly cheque that was never tied to one
 * day's bread — settles the oldest unpaid order first.
 *
 * OPEN (PAY-7): oldest-first is the ordinary way to apply money to an account
 * and it is what the owner does on paper, but nobody has confirmed it. It only
 * ever affects which order a payment is shown against, never the total owed.
 *
 * Orders must all belong to one customer; the caller filters.
 */
export function customerAccount(
  orders: readonly Order[],
  deliveries: readonly Delivery[],
  payments: readonly Payment[],
): CustomerAccount {
  const deliveryFor = (order: Order) =>
    deliveries.find((entry) => entry.orderId === order.id);

  const lines: OrderAccountLine[] = orders
    .map((order) => {
      const delivery = deliveryFor(order);
      return {
        order,
        delivery,
        duePesewas: orderAmountDuePesewas(order, delivery),
        paidPesewas: 0,
        outstandingPesewas: orderAmountDuePesewas(order, delivery),
        state: "not_due" as OrderPaymentState,
      };
    })
    .sort((a, b) => a.order.deliveryDate.localeCompare(b.order.deliveryDate));

  const counted = payments.filter(isPaymentCounted);

  const apply = (line: OrderAccountLine, amount: number): number => {
    const applied = Math.min(amount, line.outstandingPesewas);
    line.paidPesewas += applied;
    line.outstandingPesewas -= applied;
    return amount - applied;
  };

  // Money tied to a specific order goes there first, so the owner's own
  // bookkeeping is never quietly rearranged.
  let floating = 0;
  for (const payment of counted) {
    const target = payment.orderId
      ? lines.find((line) => line.order.id === payment.orderId)
      : undefined;
    floating += target ? apply(target, payment.amountPesewas) : payment.amountPesewas;
  }

  // Whatever is left settles the oldest unpaid order first.
  for (const line of lines) {
    if (floating <= 0) break;
    floating = apply(line, floating);
  }

  for (const line of lines) {
    line.state =
      line.duePesewas === 0
        ? "not_due"
        : line.outstandingPesewas === 0
          ? "paid"
          : line.paidPesewas > 0
            ? "part_paid"
            : "unpaid";
  }

  const duePesewas = sumPesewas(lines.map((line) => line.duePesewas));
  const paidPesewas = sumPesewas(counted.map((payment) => payment.amountPesewas));

  const notYetDuePesewas = sumPesewas(
    orders
      .filter((order) => order.status !== "cancelled")
      .map((order) => {
        const delivery = deliveryFor(order);
        if (delivery && delivery.status === "delivered") return 0;
        return orderTotalPesewas(order) - orderAmountDuePesewas(order, delivery);
      }),
  );

  return {
    duePesewas,
    paidPesewas,
    balancePesewas: duePesewas - paidPesewas,
    notYetDuePesewas,
    creditPesewas: floating,
    awaitingConfirmationPesewas: sumPesewas(
      payments
        .filter(isAwaitingConfirmation)
        .map((payment) => payment.amountPesewas),
    ),
    lines,
  };
}

/**
 * A customer's outstanding balance in pesewas. Positive means they owe money.
 *
 * OPEN (PAY-6): nothing here stops a balance going negative, because whether a
 * customer may go into credit — and by how much — is not decided.
 */
export function customerBalancePesewas(
  orders: readonly Order[],
  deliveries: readonly Delivery[],
  payments: readonly Payment[],
): number {
  return customerAccount(orders, deliveries, payments).balancePesewas;
}
