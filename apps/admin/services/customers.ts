/**
 * Customer service. Screens call these, never the database directly.
 */

import {
  customerAccount,
  type Customer,
  type CustomerInput,
  type Delivery,
  type Order,
  type Payment,
} from "@bread/shared";

import { supabase } from "@/lib/supabase";
import { loadCustomers, loadDeliveries, loadOrders, loadPayments } from "./loaders";

export interface CustomerSummary extends Customer {
  /** Delivered but unpaid. Positive means the customer owes money. */
  balancePesewas: number;
  /** Ordered but not delivered yet, so not owed yet (decision 0012). */
  notYetDuePesewas: number;
  /** Reported from their phone, waiting for the owner to confirm it. */
  awaitingConfirmationPesewas: number;
  orderCount: number;
}

export async function listCustomers(): Promise<CustomerSummary[]> {
  const [customers, orders, deliveries, payments] = await Promise.all([
    loadCustomers(),
    loadOrders(),
    loadDeliveries(),
    loadPayments(),
  ]);

  return customers
    .filter((customer) => !customer.archivedAt)
    .map((customer) => withSummary(customer, orders, deliveries, payments));
}

/**
 * Deliberately does not filter archived customers: an archived customer's
 * history has to stay reachable, which is the whole reason they are archived
 * rather than deleted.
 */
export async function getCustomer(id: string): Promise<CustomerSummary | null> {
  const [customers, orders, deliveries, payments] = await Promise.all([
    loadCustomers(),
    loadOrders(),
    loadDeliveries(),
    loadPayments(),
  ]);

  const customer = customers.find((entry) => entry.id === id);
  return customer ? withSummary(customer, orders, deliveries, payments) : null;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name,
      phone: input.phone,
      type: input.type,
      area: input.area,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // The one constraint a person can trip from the form.
    if (error.code === "23505") {
      throw new Error("A customer with that phone number already exists");
    }
    throw new Error(`Could not save the customer: ${error.message}`);
  }

  return {
    id: data.id as string,
    name: input.name,
    phone: input.phone,
    type: input.type,
    area: input.area,
    notes: input.notes,
    archivedAt: null,
  };
}

function withSummary(
  customer: Customer,
  allOrders: readonly Order[],
  deliveries: readonly Delivery[],
  allPayments: readonly Payment[],
): CustomerSummary {
  const orders = allOrders.filter((order) => order.customerId === customer.id);
  const payments = allPayments.filter(
    (payment) => payment.customerId === customer.id,
  );

  const account = customerAccount(orders, deliveries, payments);

  return {
    ...customer,
    balancePesewas: account.balancePesewas,
    notYetDuePesewas: account.notYetDuePesewas,
    awaitingConfirmationPesewas: account.awaitingConfirmationPesewas,
    orderCount: orders.length,
  };
}
