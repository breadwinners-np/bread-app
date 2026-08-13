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
  describeOrderLines,
  isAwaitingConfirmation,
  isPaymentCounted,
  orderQuantity,
  startOfMonth,
  todayIso,
  type Customer,
  type CustomerAccount,
  type Order,
  type Payment,
  type PaymentDecisionInput,
  type PaymentInput,
} from "@bread/shared";

import { supabase } from "@/lib/supabase";
import {
  loadCustomers,
  loadDeliveries,
  loadOrders,
  loadPayments,
} from "./loaders";

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
  /** The breads on it, as one line: "10 × Butter bread and 5 × Brown bread". */
  description: string;
  quantity: number;
  outstandingPesewas: number;
}

export async function listPayments(): Promise<PaymentWithContext[]> {
  const [payments, customers, orders] = await Promise.all([
    loadPayments(),
    loadCustomers(),
    loadOrders(),
  ]);

  return payments.map((payment) => withContext(payment, customers, orders));
}

export async function listPaymentsForCustomer(
  customerId: string,
): Promise<Payment[]> {
  const payments = await loadPayments();
  return payments.filter((payment) => payment.customerId === customerId);
}

/** Payments a customer reported that the owner has not ruled on yet. */
export async function listPaymentsAwaitingConfirmation(): Promise<
  PaymentWithContext[]
> {
  const [payments, customers, orders] = await Promise.all([
    loadPayments(),
    loadCustomers(),
    loadOrders(),
  ]);

  return payments
    .filter(isAwaitingConfirmation)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map((payment) => withContext(payment, customers, orders));
}

export async function getCustomerAccount(
  customerId: string,
): Promise<CustomerAccount> {
  const [orders, deliveries, payments] = await Promise.all([
    loadOrders(),
    loadDeliveries(),
    loadPayments(),
  ]);

  return customerAccount(
    orders.filter((order) => order.customerId === customerId),
    deliveries,
    payments.filter((payment) => payment.customerId === customerId),
  );
}

/**
 * Every customer's unsettled orders, keyed by customer.
 *
 * The record-a-payment form needs the orders for whichever customer is picked,
 * and takes them all at once so choosing a customer does not wait on a query.
 */
export async function listOpenOrdersByCustomer(): Promise<
  Record<string, OpenOrderOption[]>
> {
  const [customers, orders, deliveries, payments] = await Promise.all([
    loadCustomers(),
    loadOrders(),
    loadDeliveries(),
    loadPayments(),
  ]);

  const result: Record<string, OpenOrderOption[]> = {};

  for (const customer of customers) {
    const account = customerAccount(
      orders.filter((order) => order.customerId === customer.id),
      deliveries,
      payments.filter((payment) => payment.customerId === customer.id),
    );

    const open = account.lines
      .filter((line) => line.outstandingPesewas > 0)
      .map((line) => ({
        id: line.order.id,
        deliveryDate: line.order.deliveryDate,
        description: describeOrderLines(line.order),
        quantity: orderQuantity(line.order),
        outstandingPesewas: line.outstandingPesewas,
      }));

    if (open.length > 0) result[customer.id] = open;
  }

  return result;
}

export interface PaymentsOverview {
  receivedThisMonthPesewas: number;
  owedAcrossCustomersPesewas: number;
  awaitingConfirmationPesewas: number;
  awaitingConfirmationCount: number;
}

export async function getPaymentsOverview(): Promise<PaymentsOverview> {
  const [customers, orders, deliveries, payments] = await Promise.all([
    loadCustomers(),
    loadOrders(),
    loadDeliveries(),
    loadPayments(),
  ]);

  const today = todayIso();
  const monthStart = startOfMonth(today);

  const receivedThisMonthPesewas = payments
    .filter(isPaymentCounted)
    .filter((payment) => payment.recordedAt.slice(0, 10) >= monthStart)
    .reduce((total, payment) => total + payment.amountPesewas, 0);

  let owedAcrossCustomersPesewas = 0;
  for (const customer of customers) {
    const account = customerAccount(
      orders.filter((order) => order.customerId === customer.id),
      deliveries,
      payments.filter((payment) => payment.customerId === customer.id),
    );
    // Only money owed to the bakery adds up here. A customer in credit does not
    // cancel out another customer's debt.
    owedAcrossCustomersPesewas += Math.max(0, account.balancePesewas);
  }

  const pending = payments.filter(isAwaitingConfirmation);

  return {
    receivedThisMonthPesewas,
    owedAcrossCustomersPesewas,
    awaitingConfirmationPesewas: pending.reduce(
      (total, payment) => total + payment.amountPesewas,
      0,
    ),
    awaitingConfirmationCount: pending.length,
  };
}

/**
 * Record money the owner has in hand. Confirmed as it is saved: she is the one
 * holding the cash or the cheque, so there is nobody to confirm it with.
 */
export async function createPayment(input: PaymentInput): Promise<void> {
  const [customers, orders] = await Promise.all([loadCustomers(), loadOrders()]);

  const customer = customers.find((entry) => entry.id === input.customerId);
  if (!customer) {
    throw new Error("That customer does not exist");
  }

  if (input.orderId) {
    const order = orders.find((entry) => entry.id === input.orderId);
    if (!order || order.customerId !== customer.id) {
      throw new Error("That order does not belong to this customer");
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("payments").insert({
    customer_id: customer.id,
    order_id: input.orderId || null,
    amount_pesewas: cedisToPesewas(input.amountCedis),
    method: input.method,
    reference: input.reference ?? null,
    note: input.note ?? null,
    source: "admin",
    recorded_at: now,
    confirmed_at: now,
  });

  if (error) throw new Error(`Could not save the payment: ${error.message}`);
}

/** The owner agreeing, or not, that a reported payment arrived. */
export async function decidePayment(
  input: PaymentDecisionInput,
): Promise<void> {
  const payments = await loadPayments();

  // An UPDATE against a row that does not exist changes nothing and reports no
  // error, so the check has to happen here.
  const payment = payments.find((entry) => entry.id === input.paymentId);
  if (!payment) {
    throw new Error("That payment does not exist");
  }

  const now = new Date().toISOString();
  const decision =
    input.decision === "confirm"
      ? { confirmed_at: now, rejected_at: null }
      : { confirmed_at: null, rejected_at: now };

  const { error } = await supabase
    .from("payments")
    .update(decision)
    .eq("id", input.paymentId);

  if (error) throw new Error(`Could not save that decision: ${error.message}`);
}

function withContext(
  payment: Payment,
  customers: readonly Customer[],
  orders: readonly Order[],
): PaymentWithContext {
  const customer = customers.find((entry) => entry.id === payment.customerId);
  const order = payment.orderId
    ? orders.find((entry) => entry.id === payment.orderId)
    : undefined;

  return {
    payment,
    customerName: customer?.name ?? "Unknown customer",
    orderLabel: order ? describeOrderLines(order) : null,
  };
}
