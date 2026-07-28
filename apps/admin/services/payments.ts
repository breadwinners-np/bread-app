/**
 * Payment service.
 *
 * What a payment settles, and what a customer therefore still owes, is decided
 * by pure functions in @bread/shared — the mobile app will need exactly the
 * same answers, and two implementations would eventually disagree.
 */

import {
  cedisToPesewas,
  customerAccount,
  isAwaitingConfirmation,
  isPaymentCounted,
  orderQuantity,
  startOfMonth,
  todayIso,
  type CustomerAccount,
  type Order,
  type Payment,
  type PaymentClaimInput,
  type PaymentDecisionInput,
  type PaymentInput,
} from "@bread/shared";

import { getStore, newId, simulateLatency } from "./store";

export interface PaymentWithContext {
  payment: Payment;
  customerName: string;
  /** The order it was put against, when the owner tied it to one. */
  orderLabel: string | null;
}

/** An order a payment could be put against: delivered, and not settled yet. */
export interface OpenOrderOption {
  id: string;
  deliveryDate: string;
  productName: string;
  quantity: number;
  outstandingPesewas: number;
}

export async function listPayments(): Promise<PaymentWithContext[]> {
  const store = getStore();

  const payments = [...store.payments]
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .map(withContext);

  return simulateLatency(payments);
}

export async function listPaymentsForCustomer(
  customerId: string,
): Promise<Payment[]> {
  const store = getStore();

  const payments = store.payments
    .filter((payment) => payment.customerId === customerId)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  return simulateLatency(payments);
}

/** Payments a customer reported that the owner has not ruled on yet. */
export async function listPaymentsAwaitingConfirmation(): Promise<
  PaymentWithContext[]
> {
  const store = getStore();

  const pending = store.payments
    .filter(isAwaitingConfirmation)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map(withContext);

  return simulateLatency(pending);
}

export async function getCustomerAccount(
  customerId: string,
): Promise<CustomerAccount> {
  const store = getStore();

  return simulateLatency(
    customerAccount(
      store.orders.filter((order) => order.customerId === customerId),
      store.deliveries,
      store.payments.filter((payment) => payment.customerId === customerId),
    ),
  );
}

/**
 * Every customer's unsettled orders, keyed by customer.
 *
 * The record-a-payment form needs the orders for whichever customer is picked,
 * and the prototype has no query layer to ask again on change, so it takes them
 * all at once. Against Supabase this becomes a query per selection.
 */
export async function listOpenOrdersByCustomer(): Promise<
  Record<string, OpenOrderOption[]>
> {
  const store = getStore();
  const result: Record<string, OpenOrderOption[]> = {};

  for (const customer of store.customers) {
    const account = customerAccount(
      store.orders.filter((order) => order.customerId === customer.id),
      store.deliveries,
      store.payments.filter((payment) => payment.customerId === customer.id),
    );

    const open = account.lines
      .filter((line) => line.outstandingPesewas > 0)
      .map((line) => ({
        id: line.order.id,
        deliveryDate: line.order.deliveryDate,
        productName: productNameFor(line.order),
        quantity: orderQuantity(line.order),
        outstandingPesewas: line.outstandingPesewas,
      }));

    if (open.length > 0) result[customer.id] = open;
  }

  return simulateLatency(result);
}

export interface PaymentsOverview {
  receivedThisMonthPesewas: number;
  owedAcrossCustomersPesewas: number;
  awaitingConfirmationPesewas: number;
  awaitingConfirmationCount: number;
}

export async function getPaymentsOverview(): Promise<PaymentsOverview> {
  const store = getStore();
  const today = todayIso();
  const monthStart = startOfMonth(today);

  const receivedThisMonthPesewas = store.payments
    .filter(isPaymentCounted)
    .filter((payment) => payment.recordedAt.slice(0, 10) >= monthStart)
    .reduce((total, payment) => total + payment.amountPesewas, 0);

  let owedAcrossCustomersPesewas = 0;
  for (const customer of store.customers) {
    const account = customerAccount(
      store.orders.filter((order) => order.customerId === customer.id),
      store.deliveries,
      store.payments.filter((payment) => payment.customerId === customer.id),
    );
    // Only money owed to the bakery adds up here. A customer in credit does not
    // cancel out another customer's debt.
    owedAcrossCustomersPesewas += Math.max(0, account.balancePesewas);
  }

  const pending = store.payments.filter(isAwaitingConfirmation);

  return simulateLatency({
    receivedThisMonthPesewas,
    owedAcrossCustomersPesewas,
    awaitingConfirmationPesewas: pending.reduce(
      (total, payment) => total + payment.amountPesewas,
      0,
    ),
    awaitingConfirmationCount: pending.length,
  });
}

/**
 * Record money the owner has in hand. Confirmed as it is saved: she is the one
 * holding the cash or the cheque, so there is nobody to confirm it with.
 */
export async function createPayment(input: PaymentInput): Promise<Payment> {
  const store = getStore();

  const customer = store.customers.find((entry) => entry.id === input.customerId);
  if (!customer) {
    throw new Error("That customer does not exist");
  }

  if (input.orderId) {
    const order = store.orders.find((entry) => entry.id === input.orderId);
    if (!order || order.customerId !== customer.id) {
      throw new Error("That order does not belong to this customer");
    }
  }

  const now = new Date().toISOString();
  const payment: Payment = {
    id: newId("pay"),
    customerId: customer.id,
    orderId: input.orderId || null,
    amountPesewas: cedisToPesewas(input.amountCedis),
    method: input.method,
    reference: input.reference,
    note: input.note,
    source: "admin",
    recordedAt: now,
    confirmedAt: now,
  };

  store.payments.push(payment);
  return simulateLatency(payment);
}

/**
 * Record that a customer says they have paid.
 *
 * NOT REACHABLE YET — the buyer app does not exist. This is the seam it will
 * arrive through: the claim is stored unconfirmed, counts for nothing, and
 * appears on the owner's payments screen for her to rule on (decision 0013).
 */
export async function recordPaymentClaim(
  input: PaymentClaimInput,
): Promise<Payment> {
  const store = getStore();

  const customer = store.customers.find((entry) => entry.id === input.customerId);
  if (!customer) {
    throw new Error("That customer does not exist");
  }

  const payment: Payment = {
    id: newId("pay"),
    customerId: customer.id,
    orderId: input.orderId || null,
    amountPesewas: cedisToPesewas(input.amountCedis),
    method: input.method,
    reference: input.reference,
    source: "app",
    recordedAt: new Date().toISOString(),
    confirmedAt: null,
  };

  store.payments.push(payment);
  return simulateLatency(payment);
}

/** The owner agreeing, or not, that a reported payment arrived. */
export async function decidePayment(
  input: PaymentDecisionInput,
): Promise<void> {
  const store = getStore();

  const payment = store.payments.find((entry) => entry.id === input.paymentId);
  if (!payment) {
    throw new Error("That payment does not exist");
  }

  const now = new Date().toISOString();
  if (input.decision === "confirm") {
    payment.confirmedAt = now;
    payment.rejectedAt = null;
  } else {
    payment.rejectedAt = now;
    payment.confirmedAt = null;
  }

  await simulateLatency(null);
}

function withContext(payment: Payment): PaymentWithContext {
  const store = getStore();

  const customer = store.customers.find((entry) => entry.id === payment.customerId);
  const order = payment.orderId
    ? store.orders.find((entry) => entry.id === payment.orderId)
    : undefined;

  return {
    payment,
    customerName: customer?.name ?? "Unknown customer",
    orderLabel: order
      ? `${orderQuantity(order)} × ${productNameFor(order)}`
      : null,
  };
}

function productNameFor(order: Order): string {
  const store = getStore();
  const firstLine = order.lines[0];
  return (
    store.products.find((product) => product.id === firstLine?.productId)?.name ??
    "Unknown bread"
  );
}
